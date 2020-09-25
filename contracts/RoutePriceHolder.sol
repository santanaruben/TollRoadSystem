pragma solidity ^0.5.0;

import './TollBoothHolder.sol';
import './interfaces/RoutePriceHolderI.sol';

contract RoutePriceHolder is TollBoothHolder, RoutePriceHolderI {    

    mapping(address => mapping(address => uint)) private _routePriceMapping;

    constructor() public {
    }

    function setRoutePrice(address entryBooth, address exitBooth, uint priceWeis)
        public
        fromOwner
        returns(bool success)
    {
        require(isTollBooth(entryBooth), "Entry Booth must be registered");
        require(isTollBooth(exitBooth), "Exit Booth must be registered");
        require(entryBooth != exitBooth, "Entry and Exit must be different");
        require(entryBooth != address(0), "Entry can not be 0");
        require(exitBooth != address(0), "Exit can not be 0");
        require(_routePriceMapping[entryBooth][exitBooth] != priceWeis, "Price can not be equal to the current price");
        _routePriceMapping[entryBooth][exitBooth] = priceWeis;
        emit LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);
        success = true;
    }

    function getRoutePrice(address entryBooth, address exitBooth)
        view
        public
        returns(uint priceWeis)
    {
        if (isTollBooth(entryBooth) && isTollBooth(exitBooth) && entryBooth != exitBooth)
            priceWeis = _routePriceMapping[entryBooth][exitBooth];
        else
            priceWeis = 0;
    }
}