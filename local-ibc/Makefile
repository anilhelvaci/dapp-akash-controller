CHAIN_AG=agoric
CHAIN_COSMOS=cosmoshub-testnet

HERMES=docker run --rm -vhermes-home:/home/hermes:z -v$$PWD:/config hermes:0.9.0 -c /config/hermes.config

KEYFILE=ibc-relay-mnemonic
task/restore-keys: $(KEYFILE) task/hermes-image task/hermes-volume hermes.config
	MNEMONIC="$$(cat $(KEYFILE))"; \
	echo $$MNEMONIC | sha1sum ; \
	$(HERMES) keys restore $(CHAIN_AG) -p "m/44'/564'/0'/0/0" -m "$$MNEMONIC"; \
	$(HERMES) keys restore $(CHAIN_COSMOS) -m "$$MNEMONIC"
	mkdir -p task && touch $@

# ISSUE: these are the results of task/restore-keys
ADDR_AG=agoric1dldpyge7vhp6wt6d4ten39hv66mskrlmdw498p
ADDR_COSMOS=cosmos1p26rc0ytxvc9lhxv825ekxw43vc3ucqp4cektr

start: task/create-channel
	docker-compose up -d

task/create-channel: hermes.config task/hermes-image task/hermes-volume \
		task/restore-keys task/tap-cosmos-faucet task/tap-agoric-faucet
	$(HERMES) create channel $(CHAIN_COSMOS) $(CHAIN_AG) --port-a transfer --port-b transfer -o unordered
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

# gaiad tx ibc-transfer transfer transfer channel-73 agoric1agacedqv72t94cdalmz52fglzzqjcnywwr6zr4 15000uphoton --from relayer --node https://rpc.testnet.cosmos.network:443 --chain-id cosmoshub-testnet
# agd --home=_agstate/keys tx bank send -ojson --keyring-backend=test --gas=auto --gas-adjustment=1.2 --broadcast-mode=block --yes --chain-id=agoric --node=tcp://localhost:26657 provision agoric1dldpyge7vhp6wt6d4ten39hv66mskrlmdw498p 13000000ubld,50000000urun


RPC_AG=http://46.101.220.43:26657

task/tap-agoric-faucet: hermes.config
	@echo if the balance below is empty,
	@echo visit https://agoric.com/discord
	@echo go to the "#faucet" channel
	@echo enter: !faucet client $(ADDR_AG)
	@echo otherwise, touch $@
	exit 1
