pragma solidity ^0.5.0;

import "./Pausable.sol";
import "./Regulated.sol";
import "./MultiplierHolder.sol";
import "./DepositHolder.sol";
import "./RoutePriceHolder.sol";
import "./PullPayment.sol";
import "./interfaces/TollBoothOperatorI.sol";

contract TollBoothOperator is   Pausable, Regulated, MultiplierHolder,
                                DepositHolder, RoutePriceHolder,
                                PullPayment, TollBoothOperatorI {    

    using SafeMath for uint256;

    struct Trip {
        bool active;
        address vehicle;
        address tollBoothEntry;
        uint multiplier;
        uint deposit;
    }

    // Key: exitSecretHashed
    mapping(bytes32 => Trip) private _tripsMapping;

    struct PendingPayment {
        bytes32[] list;
        uint pendingCount;
        uint paidCount;
    }

    // The Toll Booths pending payments
    // Keys: First, the entry toll booth. Second, the exit toll booth
    mapping(address => mapping (address => PendingPayment)) private _pendingPaymentsMapping;

    constructor(bool paused, uint deposit, address regulator) 
        Pausable(paused) DepositHolder(deposit) Regulated(regulator)
        public
    {
        require(deposit != 0 && regulator != address(0));
    }

    function hashSecret(bytes32 secret)
        view
        public
        returns(bytes32 hashed)
    {
        hashed = keccak256(abi.encodePacked(secret, address(this)));
    }

    function enterRoad(address entryBooth, bytes32 exitSecretHashed)
        public
        payable
        whenNotPaused
        returns (bool success)
    {
        uint vehicleType = getRegulator().getVehicleType(msg.sender);
        uint multiplierFactor = getMultiplier(vehicleType);
        uint deposit = getDeposit();
        require(vehicleType != 0, "The vehicle is not registered");
        require(multiplierFactor != 0, "This vehicle is not allowed");
        require(isTollBooth(entryBooth), "The entry booth is not registered");
        require(deposit.mul(multiplierFactor) <= msg.value, "Not enough ETH");
        Trip storage thisTrip = _tripsMapping[exitSecretHashed];
        require(!thisTrip.active, "The secret hash has been used previously");
        thisTrip.active = true;
        thisTrip.vehicle = msg.sender;
        thisTrip.tollBoothEntry = entryBooth;
        thisTrip.deposit = msg.value;
        thisTrip.multiplier = multiplierFactor;
        emit LogRoadEntered(msg.sender, entryBooth, exitSecretHashed, multiplierFactor, msg.value);
        success = true;
    }

    function getVehicleEntry(bytes32 exitSecretHashed)
        view
        public
        returns(address vehicle, address entryBooth, uint multiplier, uint depositedWeis)
    {
        Trip storage thisTrip = _tripsMapping[exitSecretHashed];
        vehicle = thisTrip.vehicle;
        entryBooth = thisTrip.tollBoothEntry;
        multiplier = thisTrip.multiplier;
        depositedWeis = thisTrip.deposit;
    }

    function reportExitRoad(bytes32 exitSecretClear)
        public
        whenNotPaused
        returns (uint status)
    {
        require(isTollBooth(msg.sender), "You are not a Toll Booth");
        bytes32 exitSecretHashed = hashSecret(exitSecretClear);
        Trip storage thisTrip = _tripsMapping[exitSecretHashed];
        require(thisTrip.active, "The secret does not match a hashed one");
        address vehicle = thisTrip.vehicle;
        require(vehicle != address(0), "The secret has already been reported on exit");
        address entryBooth = thisTrip.tollBoothEntry;
        require(entryBooth != msg.sender, "The exit must be different to the entry");
        address operator = getOwner();
        uint fee = getRoutePrice(entryBooth, msg.sender).mul(thisTrip.multiplier);
        if (fee != 0)
        {
            pay(exitSecretHashed, operator, msg.sender, fee);
            status = 1;
        }
        else //(fee == 0)
        {
            PendingPayment storage PP = _pendingPaymentsMapping[entryBooth][msg.sender];
            PP.list.push(exitSecretHashed);
            PP.pendingCount = PP.pendingCount.add(1);
            emit LogPendingPayment(exitSecretHashed, entryBooth, msg.sender);
            status = 2;
        }
    }

    function getPendingPaymentCount(address entryBooth, address exitBooth)
        view
        public
        returns (uint count)
    {
        PendingPayment storage PP = _pendingPaymentsMapping[entryBooth][exitBooth];
        count = PP.pendingCount.sub(PP.paidCount);
    }

    function clearSomePendingPayments(address entryBooth, address exitBooth, uint count)
        public
        whenNotPaused
        returns (bool success)
    {
        require(isTollBooth(entryBooth), "The entry booth is not registered");
        require(isTollBooth(exitBooth), "The exit booth is not registered");
        require(count > 0, "Count must be greater than 0");
        clear(entryBooth, exitBooth, count);
        success = true;
    }

    function clear(address entryBooth, address exitBooth, uint count)
        internal
    {
        PendingPayment storage PP = _pendingPaymentsMapping[entryBooth][exitBooth];
        uint start = PP.paidCount;
        require(count <= PP.pendingCount.sub(start));
        uint end = start.add(count);
        uint routePrice = getRoutePrice(entryBooth, exitBooth);
        PP.paidCount = PP.paidCount.add(count);
        address operator = getOwner();
        for (uint i = start; i < end; i++){
            bytes32 exitSecretHashed = PP.list[i];
            uint fee = routePrice.mul(_tripsMapping[exitSecretHashed].multiplier);
            pay(exitSecretHashed, operator, exitBooth, fee);
        }
    }

    function pay(bytes32 exitSecretHashed, address operator, address exitBooth, uint fee)
        internal
    {
        Trip storage thisTrip = _tripsMapping[exitSecretHashed];
        address vehicle = thisTrip.vehicle;
        uint deposit = thisTrip.deposit;
        uint refund;
        thisTrip.vehicle = address(0);
        thisTrip.deposit = 0;
        thisTrip.multiplier = 0;
        if (deposit > fee)
        {
            refund = deposit.sub(fee);
            emit LogRoadExited(exitBooth, exitSecretHashed, fee, refund);
            asyncPayTo(vehicle, refund);
            asyncPayTo(operator, fee);
        }
        else //(deposit <= fee)
        {
            refund = 0;
            emit LogRoadExited(exitBooth, exitSecretHashed, deposit, refund);
            if (deposit == fee) asyncPayTo(operator, fee);
            else asyncPayTo(operator, deposit); //(deposit < fee)
        }
    }

    function setRoutePrice(address entryBooth, address exitBooth, uint priceWeis)
        public
        returns(bool success)
    {
        require(RoutePriceHolder.setRoutePrice(entryBooth, exitBooth, priceWeis));
        PendingPayment storage PP = _pendingPaymentsMapping[entryBooth][exitBooth];
        uint pendingPayments = PP.pendingCount.sub(PP.paidCount);
        if (pendingPayments > 0) clear(entryBooth, exitBooth, 1);
        success = true;
    }

    function withdrawPayment()
        public
        whenNotPaused
        returns(bool success)
    {
        require(PullPayment.withdrawPayment());
        success = true;
    }

    function() external { assert(false); }
}