// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/token/ERC20/ERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.9.3/contracts/access/Ownable.sol";

contract TokenWithCustomMinting is ERC20, Ownable {
    uint256 public maxSupply; // Максимальное количество токенов, которое можно выпустить
    uint256 public tokenPrice; // Цена за токен в wei
    address public conditionChecker; // Адрес контракта/сервиса для проверки внешнего условия

    event TokensMinted(address indexed to, uint256 amount);

    constructor(
    string memory name,       // Имя токена (например, "MyToken")
    string memory symbol,     // Символ токена (например, "MTK")
    uint256 initialSupply,    // Начальное количество токенов (например, 1000 * 10**18)
    uint256 _maxSupply,       // Максимальное количество токенов (например, 1000000 * 10**18)
    uint256 _tokenPrice       // Цена токена в wei (например, 1000000000000000 = 0.001 ETH)
    ) ERC20(name, symbol) {
        require(_maxSupply > initialSupply, "Max supply must be greater than initial supply");
        _mint(msg.sender, initialSupply);
        maxSupply = _maxSupply;
        tokenPrice = _tokenPrice;
    }

    // Функция установки адреса контракта проверки условия (может менять только владелец)
    function setConditionChecker(address _checker) external onlyOwner {
        conditionChecker = _checker;
    }

    // Функция выпуска токенов на указанный адрес, если выполняется условие
    function mintTokens(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");
        require(_checkCondition(), "Condition not met");

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }

    // Функция для изменения цены токенов (может только владелец)
    function setTokenPrice(uint256 _price) external onlyOwner {
        tokenPrice = _price;
    }

    // Вспомогательная функция проверки внешнего условия
    function _checkCondition() internal view returns (bool) {
        require(conditionChecker != address(0), "Condition checker not set");
        (bool success, bytes memory data) = conditionChecker.staticcall(
            abi.encodeWithSignature("checkCondition()")
        );
        require(success, "Failed to check condition");
        return abi.decode(data, (bool));
    }

    // Функция покупки токенов пользователем
    function buyTokens() external payable {
        uint256 amount = msg.value / tokenPrice;
        require(amount > 0, "Insufficient ETH sent");
        require(totalSupply() + amount <= maxSupply, "Exceeds max supply");

        _mint(msg.sender, amount);
        emit TokensMinted(msg.sender, amount);
    }

    // Вывод ETH из контракта (только владелец)
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}