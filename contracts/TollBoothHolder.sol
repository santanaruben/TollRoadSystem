pragma solidity ^0.5.0;

import "./Owned.sol";
import "./interfaces/TollBoothHolderI.sol";
import "./Roles.sol";

contract TollBoothHolder is Owned, TollBoothHolderI{

    using Roles for Roles.Role;
    Roles.Role private _tollBooths;

    constructor() public{
    }

    function addTollBooth(address tollBooth)
        public
        fromOwner
        returns(bool success)
    {
        _tollBooths.add(tollBooth);
        emit LogTollBoothAdded(msg.sender, tollBooth);
        success = true;
    }

    function isTollBooth(address tollBooth)
        view
        public
        returns(bool isIndeed)
    {
        isIndeed = _tollBooths.has(tollBooth);
    }

    function removeTollBooth(address tollBooth)
        public
        fromOwner
        returns(bool success)
    {
        _tollBooths.remove(tollBooth);
        emit LogTollBoothRemoved(msg.sender, tollBooth);
        success = true;
    }
}