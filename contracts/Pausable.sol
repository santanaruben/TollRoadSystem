pragma solidity >=0.5.0 <0.6.0;

import "./Owned.sol";
import "./interfaces/PausableI.sol";

contract Pausable is Owned, PausableI {

    bool private _paused;

    constructor (bool paused) public {
        _paused = paused;
    }

    function setPaused(bool newState) public fromOwner returns(bool success) {
        require(newState != _paused, "New state must be different");
        _paused = newState;
        emit LogPausedSet(msg.sender, newState);
        success = true;
    }

    function isPaused() view public returns(bool isIndeed) {
        isIndeed = _paused;
    }

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Contract not paused");
        _;
    }
}
