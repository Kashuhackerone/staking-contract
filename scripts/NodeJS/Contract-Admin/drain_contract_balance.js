/*
 * drain contract balance
 * Used by current admin only
 */
const { BN, Long, bytes, units } = require('@zilliqa-js/util');
const { Zilliqa } = require('@zilliqa-js/zilliqa');
const { toBech32Address, getAddressFromPrivateKey } = require('@zilliqa-js/crypto');

// change the following parameters
const API = 'http://localhost:5555'
const CHAIN_ID = 1;
const PRIVATE_KEY = 'd96e9eb5b782a80ea153c937fa83e5948485fbfc8b7e7c069d7b914dbc350aba'; // admin
const STAKING_PROXY_ADDR = toBech32Address("0x26b628F7a15584e2c6578B8B6572ae226c25bA3D"); // checksum proxy address

const zilliqa = new Zilliqa(API);
const MSG_VERSION = 1;
const VERSION = bytes.pack(CHAIN_ID, MSG_VERSION);
const GAS_PRICE = units.toQa('1000', units.Units.Li);


async function main() {
    zilliqa.wallet.addByPrivateKey(PRIVATE_KEY);
    const address = getAddressFromPrivateKey(PRIVATE_KEY);
    console.log("Your account address is: %o", `${address}`);
    console.log("proxy: %o\n", STAKING_PROXY_ADDR);

    console.log("------------------------ begin drain contract balance ------------------------\n");
    try {
        const contract = zilliqa.contracts.at(STAKING_PROXY_ADDR);
        const callTx = await contract.call(
            'drain_contract_balance',
            [],
            {
                version: VERSION,
                amount: new BN(0),
                gasPrice: GAS_PRICE,
                gasLimit: Long.fromNumber(10000)
            },
            33,
            1000,
            true
        );
        console.log("transaction: %o", callTx.id);
        console.log(JSON.stringify(callTx.receipt, null, 4));

    } catch (err) {
        console.log(err);
    }
    console.log("------------------------ end drain contract balance ------------------------\n");
}

main();