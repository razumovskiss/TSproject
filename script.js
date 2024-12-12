document.addEventListener('DOMContentLoaded', () => {
    const connectWalletButton = document.getElementById('connectWalletButton');
    const walletInfo = document.getElementById('walletInfo');
    const confirmButton = document.getElementById('confirmButton');
    const paymentButton = document.getElementById('paymentButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const resultText = document.getElementById('resultText');
    let connectedAccount = null;
    let paymentAmount = 0;
    
    const ARBITRUM_NETWORK = {
        chainId: '0xa4b1', // Arbitrum One chain ID
        chainName: 'Arbitrum One',
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io'],
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
        }
    };

    async function switchToArbitrum() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [ARBITRUM_NETWORK]
            });
        } catch (error) {
            showError(`Ошибка при переключении сети: ${error.message}`);
        }
    }

    connectWalletButton.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await switchToArbitrum();
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                connectedAccount = accounts[0];
                walletInfo.textContent = `Кошелек подключен: ${connectedAccount}`;
                confirmButton.disabled = false;
                showResult("Кошелек успешно подключен!");
            } catch (error) {
                if (error.code === 4001) {
                    showError("Пользователь отклонил запрос на подключение.");
                } else {
                    showError("Ошибка подключения к кошельку: " + error.message);
                }
            }
        } else {
            showError("Кошелек не найден. Установите MetaMask или другой совместимый кошелек.");
        }
    });

    confirmButton.addEventListener('click', async () => {
        if (!connectedAccount) {
            showError("Кошелек не подключен!");
            return;
        }

        const ticker = document.getElementById('ticker').value.trim();
        const number = parseInt(document.getElementById('number').value.trim());

        if (!/^[a-zA-Z]+$/.test(ticker)) {
            showError("Ошибка: Тикер должен содержать только буквы");
            return;
        }
        if (isNaN(number) || number <= 0) {
            showError("Ошибка: Количество акций должно быть положительным числом");
            return;
        }

        loadingIndicator.style.display = 'block';
        resultText.style.display = 'none';

        try {
            const price = await fetchTickerPrice(ticker);
            const totalPrice = price * number;

            const usdtRate = await fetchUSDT();
            paymentAmount = Math.ceil(totalPrice / usdtRate) + (totalPrice / usdtRate * 0.01); // точность для ETH
            showResult(`Стоимость: ${paymentAmount} USDT`);
            paymentButton.disabled = false;
        } catch (error) {
            showError(`Ошибка при получении данных: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    });

    paymentButton.addEventListener('click', async () => {
        if (!connectedAccount) {
            showError("Кошелек не подключен!");
            return;
        }
    
        try {
            loadingIndicator.style.display = 'block';
            resultText.style.display = 'none';
    
            await sendPayment(connectedAccount, paymentAmount); // Оплата без проверки баланса
            showResult("Оплата успешно проведена!");
        } catch (error) {
            showError(`Ошибка при оплате: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    });
    

    function showError(message) {
        resultText.textContent = message;
        resultText.style.display = 'block';
        resultText.style.color = 'red';
    }

    function showResult(message) {
        resultText.textContent = message;
        resultText.style.display = 'block';
        resultText.style.color = 'white';
    }

    async function fetchTickerPrice(ticker) {
        const apiUrl = `https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/${ticker}.json`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Ошибка: ${response.statusText}`);
            }
            const data = await response.json();
            return data.marketdata.data[0][12];
        } catch (error) {
            throw new Error("Не удалось получить данные по акции");
        }
    }

    async function fetchUSDT() {
        const apiUrl = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub";
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`Ошибка: ${response.statusText}`);
            }
            const data = await response.json();
            return data.tether.rub;
        } catch (error) {
            throw new Error("Не удалось получить курс USDT");
        }
    }

    async function getEthBalance(account) {
        try {
            const balance = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [account, 'latest'],
            });
            return parseFloat(balance) / 1e18; // Конвертируем из wei в ETH
        } catch (error) {
            throw new Error('Ошибка при получении баланса: ' + error.message);
        }
    }

    async function getGasPrice() {
        try {
            const gasPrice = await window.ethereum.request({
                method: 'eth_gasPrice',
            });
            return parseInt(gasPrice, 10);
        } catch (error) {
            throw new Error('Ошибка при получении цены газа: ' + error.message);
        }
    }

    const USDT_CONTRACT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // Адрес контракта USDT
    const USDT_ABI = [
        // Минимальный ABI для вызова функции transfer
        {
            "constant": false,
            "inputs": [
                {
                    "name": "_to",
                    "type": "address"
                },
                {
                    "name": "_value",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "type": "function"
        }
    ];

    async function sendPayment(account, amount) {
        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error("Некорректная сумма транзакции");
        }
    
        const recipientAddress = '0x8FD369E715C95f5B623A353a010b4c6BBF639991'; // Замените на реальный адрес
        const web3 = new Web3(window.ethereum);
        const usdtContract = new web3.eth.Contract(USDT_ABI, USDT_CONTRACT_ADDRESS);
    
        // Округляем сумму до 6 десятичных знаков
        const roundedAmount = Math.round(amount * 1e6) / 1e6;
    
        try {
            const tx = await usdtContract.methods.transfer(recipientAddress, web3.utils.toWei(roundedAmount.toString(), 'mwei')).send({ from: account });
            console.log('Transaction hash:', tx.transactionHash);
            return tx.transactionHash; // Возвращаем хэш транзакции
        } catch (error) {
            throw new Error('Ошибка при отправке транзакции: ' + error.message);
        }
    }
    
});
