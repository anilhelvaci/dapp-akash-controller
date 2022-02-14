CHAIN_AG=agoric
CHAIN_COSMOS=cosmoshub-testnet

HERMES=docker run --rm -vhermes-home:/home/hermes:z -v$$PWD:/config hermes:0.11.1 -c /config/hermes.config
KEYFILE=ibc-relay-mnemonic

task/restore-keys: $(KEYFILE) task/hermes-image task/hermes-volume hermes.config
	MNEMONIC="$$(cat $(KEYFILE))"; \
	echo $$MNEMONIC | sha1sum ; \
	$(HERMES) keys restore $(CHAIN_AG) -p "m/44'/564'/0'/0/0" -m "$$MNEMONIC"; \
	$(HERMES) keys restore $(CHAIN_COSMOS) -m "$$MNEMONIC"
	mkdir -p task && touch $@

# ISSUE: these are the results of task/restore-keys
ADDR_AG=agoric12t2yqeg4pdne7w7fadacvp8l8afevdsumhtswr
ADDR_COSMOS=cosmos1h68l7uqw255w4m2v82rqwsl6p2qmkrg08u5mye

start: task/create-channel
	docker-compose up -d

task/create-channel: hermes.config task/hermes-image task/hermes-volume \
		task/restore-keys task/tap-cosmos-faucet task/tap-agoric-faucet
	$(HERMES) create channel $(CHAIN_COSMOS) $(CHAIN_AG) --port-a transfer --port-b pegasus -o unordered
	mkdir -p task && touch $@

task/hermes-image: docker-compose.yml hermes.Dockerfile
	docker-compose build
	mkdir -p task && touch $@

hermes.Dockerfile:
	wget https://raw.githubusercontent.com/informalsystems/ibc-rs/master/ci/hermes.Dockerfile

task/hermes-volume:
	docker volume create hermes-home
	mkdir -p task && touch $@

task/tap-cosmos-faucet: hermes.config
	@echo tapping faucet
	@echo per https://tutorials.cosmos.network/connecting-to-testnet/using-cli.html#requesting-tokens-from-the-faucet
	curl -X POST -d '{"address": "$(ADDR_COSMOS)"}' https://faucet.testnet.cosmos.network
	mkdir -p task && touch $@

# gaiad keys add relayer --recover
# (enter relayer mnemonic)
# gaiad tx ibc-transfer transfer transfer channel-134 agoric1gcxr2h86zqknfwalzml8vz622jsarhn7s2e43x 15000uphoton --from relayer --node https://rpc.testnet.cosmos.network:443 --chain-id cosmoshub-testnet --yes

task/tap-agoric-faucet: hermes.config
	@echo tapping agoric faucet
	@echo agoric address $(ADDR_AG)
	agd --home=../_agstate/keys tx bank send -ojson --keyring-backend=test --gas=auto --gas-adjustment=1.2 --broadcast-mode=block --yes --chain-id=agoric --node=tcp://localhost:26657 provision $(ADDR_AG) 13000000ubld,50000000urun
	mkdir -p task && touch $@
