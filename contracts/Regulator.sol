pragma solidity ^0.5.0;

import "./interfaces/RegulatorI.sol";
import "./TollBoothOperator.sol";
import "./Roles.sol";

contract Regulator is Owned, RegulatorI{

    mapping(address => uint) private _vehicleTypeMapping;

    using Roles for Roles.Role;
    Roles.Role private _operators;

    constructor() public {
    }

    function setVehicleType(address vehicle, uint vehicleType)
        public
        fromOwner
        returns(bool success)
    {
        require(_vehicleTypeMapping[vehicle] != vehicleType, "Vehicle type must be different");
        require(vehicle != address(0), "Address can not be 0");
        _vehicleTypeMapping[vehicle] = vehicleType;
        emit LogVehicleTypeSet(msg.sender, vehicle, vehicleType);
        success = true;
    }

    function getVehicleType(address vehicle)
        view public
        returns(uint vehicleType)
    {
        vehicleType = _vehicleTypeMapping[vehicle];
    }

    function createNewOperator(address owner, uint deposit)
        public
        fromOwner
        returns(TollBoothOperatorI newOperator)
    {
        require(owner != getOwner(), "You can not be an Operator");
        require(!_operators.has(owner), "Already an Operator");
        TollBoothOperator TBO = new TollBoothOperator(true, deposit, address(this));
        TBO.setOwner(owner);
        _operators.add(address(TBO));
        emit LogTollBoothOperatorCreated(msg.sender, address(TBO), owner, deposit);
        newOperator = TollBoothOperatorI(address(TBO));
    }

    function removeOperator(address operator)
        public
        fromOwner
        returns(bool success)
    {
        _operators.remove(operator);
        emit LogTollBoothOperatorRemoved(msg.sender, operator);
        success = true;
    }

    function isOperator(address operator)
        view public
        returns(bool indeed)
    {
        indeed = _operators.has(operator);
    }
}