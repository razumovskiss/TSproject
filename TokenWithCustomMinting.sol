// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC20/ERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";

contract TokenWithCustomMinting is ERC20, Ownable {
    uint256 public maxSupply; 
    uint256 public tokenPrice; 
    address public conditionChecker; 

    event TokensMinted(address indexed to, uint256 amount);

    constructor(
    string memory name,       
    string memory symbol,    
    uint256 initialSupply,    
    uint256 _maxSupply,
    uint256 _tokenPrice
    ) ERC20(name, symbol) {
        require(_maxSupply > initialSupply, "Max supply must be greater than initial supply");
        _mint(msg.sender, initialSupply);
        maxSupply = _maxSupply;
        tokenPrice = _tokenPrice;
    }

    function setConditionChecker(address _checker) external onlyOwner {
        conditionChecker = _checker;
    }

    function mintTokens(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        require(_checkCondition(), "Condition not met");

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }

    function setTokenPrice(uint256 _price) external onlyOwner {
        tokenPrice = _price;
    }

    function _checkCondition() internal view returns (bool) {
        require(conditionChecker != address(0), "Condition checker not set");
        (bool success, bytes memory data) = conditionChecker.staticcall(
            abi.encodeWithSignature("checkCondition()")
        );
        require(success, "Failed to check condition");
        return abi.decode(data, (bool));
    }

    function buyTokens() external payable {
        uint256 amount = msg.value / tokenPrice;
        require(amount > 0, "Insufficient ETH sent");
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");

        _mint(msg.sender, amount);
        emit TokensMinted(msg.sender, amount);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
