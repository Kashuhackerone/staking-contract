# Seed Node Staking Contracts

Seed node staking in [Zilliqa](https://www.zilliqa.com) as described in [ZIP-3](https://github.com/Zilliqa/ZIP/blob/master/zips/zip-3.md) makes use of three contracts written in [Scilla](https://scilla.readthedocs.io/en/latest/). This repository is the central portal that collates together the [contracts](./contracts), documentations around them, [unit tests](./tests), [scripts and SDK code snippets](./scripts) to deploy and run the contracts on the network.

In the sections below, we describe in detail:
1) the purpose of each contract,
2) their structure and specifications,
3) running unit tests for the contracts.

# Table of Content

- [Disclaimer](#disclaimer)
- [Overview](#overview)
- [Security audit of smart contract](#Security-audit-of-smart-contract)
- [SSNList Contract Specification](#ssnlist-contract-specification)
  * [Roles and Privileges](#roles-and-privileges)
  * [Immutable Parameters](#immutable-parameters)
  * [Mutable Fields](#mutable-fields)
  * [Transitions](#transitions)
    + [Housekeeping Transitions:](#housekeeping-transitions-)
    + [Pause Transitions](#pause-transitions)
    + [SSN Operation Transitions](#ssn-operation-transitions)
- [SSNListProxy Contract Specification](#ssnlistproxy-contract-specification)
  * [Roles and Privileges](#roles-and-privileges-1)
  * [Immutable Parameters](#immutable-parameters-1)
  * [Mutable Fields](#mutable-fields-1)
  * [Transitions](#transitions-1)
      + [Housekeeping Transitions](#housekeeping-transitions)
      + [Relay Transitions](#relay-transitions)
- [Multi-signature Wallet Contract Specification](#multi-signature-wallet-contract-specification)
  * [General Flow](#general-flow)
  * [Roles and Privileges](#roles-and-privileges-2)
  * [Immutable Parameters](#immutable-parameters-2)
  * [Mutable Fields](#mutable-fields-2)
  * [Transitions](#transitions-2)
    + [Submit Transitions](#submit-transitions)
    + [Action Transitions](#action-transitions)

# Disclaimer

By participating in the staking of ZILs (“Staking Program”), each participating individual and organization ("Participant") accepts and agrees that, to the extent permitted by law, [Zilliqa] disclaims all liability, damages, cost, loss or expense (including, without limitation, legal fees, costs and expenses) to it in respect of its involvement in the Staking Program. Each Participant should carefully consider all factors involved in participating in the Staking Program, including, but not limited to, those listed below and, to the extent necessary, consult an appropriate professional or other expert (including an expert in cryptographic tokens or blockchain-based software systems). If any of the following considerations are unacceptable to a Participant, that Participant should not be involved in the Staking Program. These considerations are not intended to be exhaustive and should be used as guidance only.

- The Staking Program is an open source protocol made available to the public, and Zilliqa expressly disclaims any liability in respect of any actions, programs, applications, developments, and operations of the Staking Program.
- Hackers, individuals, other malicious groups or organisations may attempt to interfere with the Zilliqa Blockchain System, the ZILs and the Staking Program in a variety of ways such as cryptographic attacks, malware attacks, denial of service attacks, consensus-based attacks, Sybil attacks, smurfing and spoofing.
- The regulatory status of cryptographic tokens, blockchain and distributed ledger technology as well as its applications are unclear or unsettled in many jurisdictions and it is difficult to predict how or whether governments or regulatory agencies may implement changes to law or apply existing regulation with respect to such technology and its applications, including the Zilliqa Blockchain System, the ZILs and the Staking Program.
- The ZILs are not intended to represent any formal or legally binding investment. Cryptographic tokens that possess value in public markets, such as Ether and Bitcoin, have demonstrated extreme fluctuations in price over short periods of time on a regular basis. Participants should be prepared to expect similar fluctuations in the price of the ZILs and Participants may experience a complete and permanent loss of their initial purchase.


The ZILs are not intended to be securities (or any other regulated instrument) under the laws of any jurisdiction where they are intended to be, or will be, purchased or sold and no action has been or will be taken in any jurisdiction by Zilliqa Research or any of its affiliates that would permit a public offering, or any other offering under circumstances not permitted by applicable law of the ZILs, in any country or jurisdiction where action for that purpose is required. Accordingly, the ZILs may not be offered or sold, directly or indirectly, by any holder, in or from any country or jurisdiction, except in circumstances which will result in compliance with all applicable rules and regulations of any such country or jurisdiction.

# Overview

The table below summarizes the purpose of the three contracts that ZIP-3 will broadly use:

| Contract Name | File and Location | Description |
|--|--| --|
|SSNList| [`ssnlist.scilla`](./contracts/ssnlist.scilla)  | The main contract that keeps track of Staked Seed Nodes _aka_ SSNs, the amount staked, and available rewards.|
|SSNListProxy| [`proxy.scilla`](./contracts/proxy.scilla)  | A proxy contract that sits on top of the SSNList contract. Any call to the `SSNList` contract must come from `SSNListProxy`. This contract facilitates upgradeability of the `SSNList` contract in case a bug is found.|
|Wallet| [`multisig_wallet.scilla`](./contracts/multisig_wallet.scilla)  | A multisig wallet contract tailored to work with the `SSNListproxy` contract. Certain transitions in the `SSNListProxy` contract can only be invoked when k-out-of-n users have agreed to do so. This logic is handled using the `Wallet` contract. |

# Security audit of smart contract

The smart contracts has been audited by [Quantstamp](https://quantstamp.com/). A copy of the security audit report can be found [here](Staked_Seed_Node_SSN_Operations-Report.pdf) or on [Quantstamp certification website](https://certificate.quantstamp.com/).

# SSNList Contract Specification

The SSNList contract is the main contract that is central to the entire staking infrastructure. 

## Roles and Privileges

The table below describes the roles and privileges that this contract defines:

| Role | Description & Privileges|                                    
| --------------- | ------------------------------------------------- |
| `ssn`           | A registered SSN that provides the seed node service and gets rewarded for the service. |
| `verifier`      | An entity that checks the health of an SSN and rewards them accordingly for their service.                                 |
| `admin`    | The administrator of the contract.  `admin` is a multisig wallet contract (aka an instance of `Wallet`).    |
|`initiator` | The user who calls the `SSNListProxy` that in turn calls the `SSNList` contract. |

## Immutable Parameters

The table below lists the parameters that are defined at the contract deployment time and hence cannot be changed later on.

| Name | Type | Description |                                    
| --------------- | ------------------------------------------------- |-|
| `init_admin` | `ByStr20` | The initial admin of the contract.          |
| `proxy_address` | `ByStr20` | Address of the `SSNListProxy` contract.  |

## Mutable Fields

The contract defines and uses a custom ADT named `Ssn` as explained below: 

```
type Ssn = 
| Ssn of Bool Uint128 Uint128 String String Uint128
(* The first argument of type Bool represents the status of the SSN. An active SSN will have this field set to True.  *)
(* The second argument of type Uint128 represents the amount staked by the SSN. *)
(* The third argument of type Uint128 represents the rewards that this SSN can withdraw. *)
(* The fourth argument of type String represents the raw URL for the SSN to fetch raw blockchain data. *)
(* The fifth argument of type String represents the URL API endpoint for the SSN similar to api.zilliqa.com. *)
(* The sixth and the last argument of type Uint128 represents the deposit made by the SSN that cannot be considered for reward calculations in the current reward cycle. *)
```

The table below presents the mutable fields of the contract and their initial values. 

| Name        | Type       | Initial Value                           | Description                                        |
| ----------- | --------------------|--------------- | -------------------------------------------------- |
| `ssnlist`   | `Map ByStr20 Ssn` | `Emp ByStr20 Ssn` |Mapping between SSN addresses and the corresponding `Ssn` information. |
| `verifier`   | `Option ByStr20` | `None {ByStr20}` | The address of the `verifier`. |
| `minstake`  | `Uint128` | `Uin128 0`       | Minimum stake required to activate an SSN (in `Qa`, where 1 `Qa` = 10<sup>-12</sup> `ZIL`). |
| `maxstake`  | `Uint128`  | `Uint128 0`                       | Maximum stake (in `Qa`) allowed for each SSN. |
| `contractmaxstake`  | `Uint128`  | `Uint128 0` | The maximum amount (in `Qa`) that can ever be staked across all SSNs. |
| `totalstakeddeposit`  | `Uint128`  | `Uint128 0` | The total amount (in `Qa`) that is currently staked in the contract. |
| `contractadmin` | `ByStr20` |  `init_admin` | Address of the administrator of this contract. |
|`paused` | `ByStr20` | `True` | A flag to record the paused status of the contract. Certain transitions in the contract cannot be invoked when the contract is paused. |
|`lastrewardblocknum` | `Uint32` | `Uint32 0` | The block number when the last reward was distributed. |

## Transitions 

Note that each of the transitions in the `SSNList` contract takes `initiator` as a parameter which as explained above is the caller that calls the `SSNListProxy` contract which in turn calls the `SSNList` contract. 

> Note: No transition in the `SSNList` contract can be invoked directly. Any call to the `SSNList` contract must come from the `SSNListProxy` contract.

All the transitions in the contract can be categorized into three categories:

* **Housekeeping Transitions:** Meant to facilitate basic admin-related tasks.
* **Pause Transitions:** Meant to pause and un-pause the contract.
* **SSN Operation Transitions:** The core transitions that the `verifier` and the SSNs will invoke as a part of the SSN operation.

Each of these category of transitions are presented in further detail below.

### Housekeeping Transitions

| Name        | Params     | Description | Callable when paused?|
| ----------- | -----------|-------------|:--------------------------:|
| `update_admin` | `admin : ByStr20, initiator : ByStr20` | Replace the current `contractadmin` by `admin`. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.| :heavy_check_mark: |
| `update_verifier` | `verif : ByStr20, initiator : ByStr20` | Replace the current `verifier` by `verif`. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.| :heavy_check_mark: |
| `update_staking_parameter` | `min_stake : Uint128, max_stake : Uint128, contract_max_stake : Uint128, initiator : ByStr20` | Update the value of the field `minstake`, `maxstake` and `contractmaxstake` to the input value `min_stake`, `max_stake` and `contract_max_stake` respectively. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.| <center>:x:</center> |
| `drain_contract_balance` | `initiator : ByStr20` | Allows the admin to withdraw the entire balance of the contract. It should only be invoked in case of emergency. The withdrawn ZILs go to a multsig wallet contract that represents the `admin`. :warning: **Note:** `initiator` must be the current `contractadmin` of the contract. | :heavy_check_mark:|

### Pause Transitions

| Name        | Params     | Description | Callable when paused?|
| ----------- | -----------|-------------|:--------------------------:|
| `pause` | `initiator : ByStr20`| Pause the contract temporarily to stop any critical transition from being invoked. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.  | :heavy_check_mark: | 
| `unpause` | `initiator : ByStr20`| Un-pause the contract to re-allow the invocation of all transitions. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.  | :heavy_check_mark: |

### SSN Operation Transitions

| Name        | Params     | Description | Callable when paused?|
| ----------- | -----------|-------------|:--------------------------:|
| `add_ssn` | `ssnaddr : ByStr20, urlraw : String, urlapi : String, initiator : ByStr20`| Add a new SSN with the 0 staked deposit, 0 staked reward and 0 buffered deposit. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.  | <center>:x:</center> |
| `add_ssn_after_upgrade` | `ssnaddr : ByStr20, stake_amount : Uint128, rewards : Uint128, urlraw : String, urlapi : String, buffered_deposit : Uint128, initiator : ByStr20`| Add a new SSN with the passed values. Only for Use after contract upgrade. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.  | <center>:x:</center> | 
| `remove_ssn` | `ssnaddr : ByStr20, initiator : ByStr20`| Remove a given SSN with address `ssnaddr`. <br>  :warning: **Note:** `initiator` must be the current `contractadmin` of the contract.  | <center>:x:</center> |
| `stake_deposit` | `initiator : ByStr20` | Accept the deposit of ZILs from the `initiator` which should be a registered SSN in the contract. | <center>:x:</center> | 
| `assign_stake_reward` | `ssnreward_list : List SsnRewardShare, reward_blocknum : Uint32, initiator : ByStr20` | To assign rewards to the SSNs based on their performance. Performance checks happen off the chain. <br>  :warning: **Note:** `initiator` must be the current `verifier` of the contract. | <center>:x:</center> |
| `withdraw_stake_rewards` | `initiator : ByStr20` | A registered SSN (`initiator`) can call this transition to withdraw its stake rewards. Stake rewards represent the rewards that an SSN has earned based on its performance. If the SSN has already withdrawn its deposit, then the SSN is removed. | <center>:x:</center> |
| `withdraw_stake_amount` | `amount : Uint128, initiator : ByStr20` | A registered SSN (`initiator`) can call this transition to withdraw its deposit. The amount to be withdrawn is the input value `amount`. Stake amount represents the deposit that an SSN has made so far.   <br> :warning: **Note:** <ul><li> Any partial withdrawal should ensure that the remaining deposit is greater than `min_stake`. Partial withdrawals that push the deposit amount to be lower than `min_stake` are denied. </li> <li> In case there is a non-zero buffereddeposit, withdrawal is denied. </li> <li> If the withdrawal is for the entire deposit but rewards have not been fully withdrawn, then the SSN becomes inactive. </li> <li> If the withdrawal is for the entire deposit and if the rewards have also been withdrawn, then the SSN is removed. </li> </ul>  | <center>:x:</center> |
| `AddFunds` | `initiator : ByStr20` | Deposit ZILs into the contract.  | <center>:x:</center> |

>**Note:** `Ssn` custom ADT has a field status of type `Bool`: `True` representing an active SSN. The value of this field depends on whether or not the amount staked by this SSN and the rewards held by this SSN are zero. The table below presents the different possible configurations and the value of the status field for each configuration. Note that when both the staked amount is zero and the reward is zero, the SSN is removed. <br>
>| Staked Amount Value | Reward Amount Value | SSN Status |
>| -- | -- | -- |
>| Zero | Non-zero | `False`|
>| Non-zero | Zero | `True`|
>| Non-zero | Non-zero | `True`|
>| Zero | Zero | `Removed`|

# SSNListProxy Contract Specification

`SSNListProxy` contract is a relay contract that redirects calls to it to the `SSNList` contract.

## Roles and Privileges

The table below describes the roles and privileges that this contract defines:

| Role | Description & Privileges|                                    
| --------------- | ------------------------------------------------- |
| `init_admin`           | The initial admin of the contract which is usually the creator of the contract. `init_admin` is also the initial value of `admin`. |                                 |
| `admin`    | Current `admin` of the contract initialized to `init_admin`. Certain critical actions can only be performed by the `admin`, e.g., changing the current implementation of the `SSNList` contract. |
|`initiator` | The user who calls the `SSNListProxy` contract that in turn calls the `SSNList` contract. |

## Immutable Parameters

The table below lists the parameters that are defined at the contract deployment time and hence cannot be changed later on.

| Name | Type | Description |
|--|--|--|
|`init_implementation`| `ByStr20` | The address of the `SSNList` contract. |
|`init_admin`| `ByStr20` | The address of the admin. |

## Mutable Fields

The table below presents the mutable fields of the contract and their initial values.

| Name | Type | Initial Value |Description |
|--|--|--|--|
|`implementation`| `ByStr20` | `init_implementation` | Address of the current implementation of the `SSNList` contract. |
|`admin`| `ByStr20` | `init_owner` | Current admin of the contract. |

## Transitions

All the transitions in the contract can be categorized into two categories:
- **Housekeeping Transitions:** Meant to facilitate basic admin-related tasks.
- **Relay Transitions:** To redirect calls to the `SSNList` contract.

### Housekeeping Transitions

| Name | Params | Description |
|--|--|--|
|`upgradeTo`| `newImplementation : ByStr20` |  Change the current implementation address of the `SSNList` contract. <br> :warning: **Note:** Only the `admin` can invoke this transition.|
|`changeProxyAdmin`| `newAdmin : ByStr20` |  Change the current `admin` of the contract. <br> :warning: **Note:** Only the `admin` can invoke this transition.|
| `drainProxyContractBalance`| | Drain proxy contract balance back to the caller. <br> :warning: **Note:** Only the `admin` can invoke this transition. |

### Relay Transitions

These transitions are meant to redirect calls to the corresponding `SSNList` contract. Redirecting the contract prepares the `initiator` value that is the address of the caller of the `SSNListProxy` contract. The signature of transitions in the two contracts is exactly the same except the added last parameter `initiator` for the transition in the `SSNList` contract.

| Transition signature in the `SSNListProxy` contract  | Target transition in the `SSNList` contract |
|--|--|
|`pause()` | `pause(initiator : ByStr20)` |
|`unpause()` | `unpause(initiator : ByStr20)` |
|`update_admin(admin: ByStr20)` | `update_admin(admin: ByStr20, initiator : ByStr20)`|
|`update_verifier(verif : ByStr20)` | `update_verifier (verif : ByStr20, initiator: ByStr20)`|
|`drain_contract_balance()` | `drain_contract_balance(initiator : ByStr20)`|
|`update_staking_parameter (min_stake : Uint128, max_stake : Uint128, contract_max_stake : Uint128)` | `update_staking_parameter (min_stake : Uint128, max_stake : Uint128, contract_max_stake : Uint128, initiator : ByStr20)`|
|`add_ssn (ssnaddr : ByStr20, urlraw : String, urlapi : String)` | `add_ssn (ssnaddr : ByStr20, urlraw : String, urlapi : String, initiator : ByStr20)`|
|`add_ssn_after_upgrade (ssnaddr : ByStr20, stake_amount : Uint128, rewards : Uint128, urlraw : String, urlapi : String, buffered_deposit : Uint128)` | `add_ssn_after_upgrade (ssnaddr : ByStr20, stake_amount : Uint128, rewards : Uint128, urlraw : String, urlapi : String, buffered_deposit : Uint128, initiator : ByStr20)`|
|`remove_ssn (ssnaddr : ByStr20)` | `remove_ssn (ssnaddr : ByStr20, initiator: ByStr20)`|
|`stake_deposit()` | `stake_deposit (initiator: ByStr20)`|
|`assign_stake_reward (ssnreward_list : List SsnRewardShare, reward_blocknum : Uint32)` | `assign_stake_reward (ssnreward_list : List SsnRewardShare, reward_blocknum : Uint32, initiator: ByStr20)`|
|`withdraw_stake_rewards()` | `withdraw_stake_rewards (initiator : ByStr20)`|
|`withdraw_stake_amount (amount : Uint128)` | `withdraw_stake_amount (amount : Uint128, initiator: ByStr20)`|
|`AddFunds()` | `AddFunds (initiator : ByStr20)`|

# Multi-signature Wallet Contract Specification

This contract has two main roles. First, it holds funds that can be paid out to arbitrary users, provided that enough people from a pre-defined set of owners have signed off on the payout.

Second, and more generally, it also represents a group of users that can invoke a transition in another contract only if enough people in that group have signed off on it. In the staking context, it represents the `admin` in the `SSNList` contract. This provides added security for the privileged `admin` role.

## General Flow

Any transaction request (whether transfer of payments or invocation of a foreign transition) must be added to the contract before signatures can be collected. Once enough signatures are collected, the recipient (in case of payments) and/or any of the owners (in the general case) can ask for the transaction to be executed.

If an owner changes his mind about a transaction, the signature can be revoked up until the transaction has been executed.

This wallet does not allow adding or removing owners, or changing the number of required signatures. To do any of those, perform the following steps:

1. Deploy a new wallet with `owners` and `required_signatures` set to the new values. `MAKE SURE THAT THE NEW WALLET HAS BEEN SUCCESFULLY DEPLOYED WITH THE CORRECT PARAMETERS BEFORE CONTINUING!`
2. Invoke the `SubmitTransaction` transition on the old wallet with the following parameters:
   - `recipient` : The `address` of the new wallet
   - `amount` : The `_balance` of the old wallet
   - `tag` : `AddFunds`
3. Have (a sufficient number of) the owners of the old contract invoke the `SignTransaction` transition on the old wallet. The parameter `transactionId` should be set to the `Id` of the transaction created in step 2.
4. Have one of the owners of the old contract invoke the `ExecuteTransaction` transition on the old contract. This will cause the entire balance of the old contract to be transferred to the new wallet. Note that no un-executed transactions will be transferred to the new wallet along with the funds.

> WARNING: If a sufficient number of owners lose their private keys, or for any other reason are unable or unwilling to sign for new transactions, the funds in the wallet will be locked forever. It is therefore a good idea to set required_signatures to a value strictly less than the number of owners, so that the remaining owners can retrieve the funds should such a scenario occur.
<br> <br> If an owner loses his private key, the remaining owners should move the funds to a new wallet (using the workflow described above) to  ensure that funds are not locked if another owner loses his private key. The owner who originally lost his private key can generate a new key, and the corresponding address be added to the new wallet, so that the same set of people own the new wallet.

## Roles and Privileges

The table below list the different roles defined in the contract.

| Name | Description & Privileges |
|--|--|
|`owners` | The users who own this contract. |

## Immutable Parameters

The table below lists the parameters that are defined at the contract deployment time and hence cannot be changed later on.

| Name | Type | Description |
|--|--|--|
|`owners_list`| `List ByStr20` | List of initial owners. |
|`required_signatures`| `Uint32` | Minimum amount of signatures to execute a transaction. |

## Mutable Fields

The table below presents the mutable fields of the contract and their initial values.

| Name | Type | Initial Value | Description |
|--|--|--|--|
|`owners`| `Map ByStr20 Bool` | `owners_list` | Map of owners. |
|`transactionCount`| `Uint32` | `0` | The number of of transaction requests submitted so far. |
|`signatures`| `Map Uint32 (Map ByStr20 Bool)` | `Emp Uint32 (Map ByStr20 Bool)` | Collected signatures for transactions by transaction ID. |
|`signature_counts`| `Map Uint32 Uint32` | `Emp Uint32 Uint32` | Running count of collected signatures for transactions. |
|`transactions`| `Map Uint32 Transaction` | `Emp Uint32 Transaction` | Transactions that have been submitted but not executed yet. |

## Transitions

All the transitions in the contract can be categorized into three categories:
- **Submit Transitions:** Create transactions for future signoff.
- **Action Transitions:** Let owners sign, revoke or execute submitted transactions.
- The `_balance` field keeps the amount of funds held by the contract and can be freely read within the implementation. The `AddFunds` transition is used for adding native funds (`ZIL`) to the wallet from incoming messages by using the `accept` keyword.

### Submit Transitions

The first transition is meant to submit a request for transfer of native `ZIL`s while the others are meant to submit a request to invoke transitions in the `SSNListProxy` contract.

| Name | Params | Description |
|--|--|--|
|`SubmitNativeTransaction`| `recipient : ByStr20, amount : Uint128, tag : String` | Submit a request for transfer of native tokens for future signoffs. |
|`SubmitCustomUpgradeToTransaction`| `proxyContract : ByStr20, newImplementation : ByStr20` | Submit a request to invoke the `upgradeTo` transition in the `SSNListProxy` contract. |
|`SubmitCustomPauseTransaction`| `proxyContract : ByStr20` | Submit a request to invoke the `pause` transition in the `SSNListProxy` contract. |
|`SubmitCustomUnpauseTransaction`| `proxyContract : ByStr20` | Submit a request to invoke the `unpause` transition in the `SSNListProxy` contract. |
|`SubmitCustomChangeProxyAdminTransaction`| `proxyContract : ByStr20, newAdmin : ByStr20` | Submit a request to invoke the `changeProxyAdmin` transition in the `SSNListProxy` contract. |
|`SubmitCustomUpdateAdminTransaction`| `proxyContract : ByStr20, admin : ByStr20` | Submit a request to invoke the `update_admin` transition in the `SSNListProxy` contract. |
|`SubmitCustomUpdateVerifierTransaction`| `proxyContract : ByStr20, verif : ByStr20` | Submit a request to invoke the `update_verifier` transition in the `SSNListProxy` contract. |
|`SubmitCustomUpdateStakingParameterTransaction`| `proxyContract : ByStr20, min_stake : Uint128, max_stake : Uint128, contract_max_stake : Uint128` | Submit a request to invoke the `update_staking_parameter` transition in the `SSNListProxy` contract. |
|`SubmitCustomDrainContractBalanceTransaction`| `proxyContract : ByStr20` | Submit a request to invoke the `drain_contract_balance` transition in the `SSNListProxy` contract. |
|`SubmitCustomDrainProxyContractBalance`| `proxyContract : ByStr20` | Submit a request to invoke the `drainProxyContractBalance` transition in the `SSNListProxy` contract. |
|`SubmitCustomAddSsnTransaction`| `proxyContract : ByStr20, ssnaddr : ByStr20, urlraw : String, urlapi : String` | Submit a request to invoke the `add_ssn` transition in the `SSNListProxy` contract. |
|`SubmitCustomAddSsnAfterUpgradeTransaction`| `proxyContract : ByStr20, ssnaddr : ByStr20, stake_amount : Uint128, rewards : Uint128, urlraw : String, urlapi : String, buffered_deposit : Uint128` | Submit a request to invoke the `add_ssn_after_upgrade` transition in the `SSNListProxy` contract. |
|`SubmitCustomRemoveSsnTransaction`| `proxyContract : ByStr20, ssnaddr : ByStr20` | Submit a request to invoke the `remove_ssn` transition in the `SSNListProxy` contract. |

### Action Transitions

| Name | Params | Description |
|--|--|--|
|`SignTransaction`| `transactionId : Uint32` | Sign off on an existing transaction. |
|`RevokeSignature`| `transactionId : Uint32` | Revoke signature of an existing transaction, if it has not yet been executed. |
|`ExecuteTransaction`| `transactionId : Uint32` | Execute signed-off transaction. |
