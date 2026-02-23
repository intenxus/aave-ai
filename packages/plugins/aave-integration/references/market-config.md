# AAVE V3 Market Configuration

## Overview
This document contains the core contract addresses for AAVE V3 markets on supported chains.

## Pool Addresses Provider

The PoolAddressesProvider is the main registry for all AAVE V3 contract addresses on each chain.

| Chain | Chain ID | Address |
|-------|----------|---------|
| Ethereum | 1 | `0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e` |
| Arbitrum | 42161 | `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb` |

## Pool (Proxy)

The Pool contract is the main entry point for all user operations (supply, borrow, repay, withdraw).

| Chain | Chain ID | Address |
|-------|----------|---------|
| Ethereum | 1 | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` |
| Arbitrum | 42161 | `0x794a61358D6845594F94dc1DB02A252b5b4814aD` |

## UI Pool Data Provider

The UiPoolDataProvider provides aggregated data about reserves and user positions for UI applications.

| Chain | Chain ID | Address |
|-------|----------|---------|
| Ethereum | 1 | `0x91c0eA31b49B69Ea18607702c5d9aC360bf3dE7d` |
| Arbitrum | 42161 | `0x5c5228aC8BC1528482514aF3e27D692c20E5c41F` |

## Pool Data Provider (AaveProtocolDataProvider)

The AaveProtocolDataProvider provides detailed protocol data including reserve configurations.

| Chain | Chain ID | Address |
|-------|----------|---------|
| Ethereum | 1 | `0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3` |
| Arbitrum | 42161 | `0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654` |

## Usage Notes

- All addresses are verified against official AAVE documentation
- When interacting with the protocol, always use the PoolAddressesProvider to get the current Pool address
- The UI Pool Data Provider is used for reading aggregated reserve data
- The Pool Data Provider is used for reading detailed protocol configuration

## References

- AAVE V3 Documentation: https://docs.aave.com/developers/deployed-contracts/v3-mainnet
- AAVE Address Book: https://github.com/aave/aave-address-book
