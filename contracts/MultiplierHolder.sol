pragma solidity ^0.5.0;

import "./Owned.sol";
import "./interfaces/MultiplierHolderI.sol";

contract MultiplierHolder is Owned, MultiplierHolderI{

    mapping(uint => uint) private _multiplierFactorMapping;

    constructor() public {
    }

    function setMultiplier(uint vehicleType, uint multiplier)
        public
        fromOwner
        returns(bool success)
    {
        require(vehicleType != 0, "The type can not be 0");
        require(multiplier != _multiplierFactorMapping[vehicleType], "Must be a different multiplier factor");
        _multiplierFactorMapping[vehicleType] = multiplier;
        emit LogMultiplierSet(msg.sender, vehicleType, multiplier);
        success = true;
    }

    function getMultiplier(uint vehicleType)
        view
        public
        returns(uint multiplier)
    {
        multiplier = _multiplierFactorMapping[vehicleType];
    }
}