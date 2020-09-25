pragma solidity ^0.5.0;

import "./interfaces/RegulatedI.sol";

contract Regulated is RegulatedI{

    address private _regulator;

    constructor(address regulator) public {
        require(regulator != address(0), "Address can not be 0");
        _regulator = regulator;
        emit LogRegulatorSet(address(0), regulator);
    }

    function setRegulator(address newRegulator)
        public
        returns(bool success)
    {
        address oldRegulator = _regulator;
        require(msg.sender == oldRegulator, "You need to be the regulator");
        require(newRegulator != address(0), "Address can not be 0");
        require(newRegulator != oldRegulator, "Must be different regulator");
        _regulator = newRegulator;
        emit LogRegulatorSet(oldRegulator, newRegulator);
        success = true;
    }

    function getRegulator()
        view
        public
        returns(RegulatorI regulator)
    {
        regulator = RegulatorI(_regulator);
    }
}