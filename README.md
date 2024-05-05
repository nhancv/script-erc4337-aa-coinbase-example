# DEVELOPMENT

- Sign in to Coinbase Developer: https://portal.cdp.coinbase.com/products/base
- Docs: https://docs.cdp.coinbase.com/base-node/docs/paymaster-bundler-qs
- Example: https://github.com/coinbase/paymaster-bundler-examples

## Limitation

- No support for ERC20 token payment
- No support for Whitelist on Contract ABI functions
- No support for ETH transfer (data = 0x)

## Install dep

```
git clone git@github.com.....
cd script-erc4337-aa-coinbase-example
yarn install
```

## Prepare environment config

```
cp .env.example .env

# Update .env content
# Setup other secret configs as well
```

## Local dev

- Normal mode - without monitor

```
yarn start
```

- Monitor mode

```
yarn start:dev
```

## Build production

```
yarn build
```
