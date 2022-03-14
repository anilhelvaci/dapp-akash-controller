CHAIN_AG=agoric
CHAIN_AKASH=edgenet-1

HERMES=docker run --rm -vhermes-home:/home/hermes:z -v$$PWD:/config hermes:0.12.0-pre -c /config/hermes.config
KEYFILE=ibc-relay-mnemonic

task/restore-keys: $(KEYFILE) task/hermes-image task/hermes-volume hermes.config
	MNEMONIC="$$(cat $(KEYFILE))"; \
	echo $$MNEMONIC | sha1sum ; \
	$(HERMES) keys restore $(CHAIN_AG) -p "m/44'/564'/0'/0/0" -m "$$MNEMONIC"; \
	$(HERMES) keys restore $(CHAIN_AKASH) -m "$$MNEMONIC"
	mkdir -p task && touch $@

# ISSUE: these are the results of task/restore-keys
ADDR_AG=agoric12t2yqeg4pdne7w7fadacvp8l8afevdsumhtswr
ADDR_AKASH=akash1h68l7uqw255w4m2v82rqwsl6p2qmkrg028euar

start: task/create-channel
	docker-compose up -d

task/create-channel: hermes.config task/hermes-image task/hermes-volume \
		task/restore-keys task/tap-akash-faucet task/tap-agoric-faucet
	$(HERMES) create channel $(CHAIN_AKASH) $(CHAIN_AG) --port-a transfer --port-b pegasus -o unordered
	mkdir -p task && touch $@

task/hermes-image: docker-compose.yml hermes.Dockerfile
	docker-compose build
	mkdir -p task && touch $@

hermes.Dockerfile:
	wget https://raw.githubusercontent.com/informalsystems/ibc-rs/master/ci/hermes.Dockerfile

task/hermes-volume:
	docker volume create hermes-home
	mkdir -p task && touch $@

task/tap-akash-faucet: hermes.config
	@echo tapping faucet
	@echo per http://55ma08d6b9aht4gtovcih95dps.ingress.edgenet-1.ewr1.aksh.pw
	curl -X POST -d 'address=$(ADDR_AKASH)' http://55ma08d6b9aht4gtovcih95dps.ingress.edgenet-1.ewr1.aksh.pw/faucet
	mkdir -p task && touch $@

# akash keys add relayer --recover
# (enter relayer mnemonic)
# akash tx ibc-transfer transfer transfer channel-5 agoric1ajygmq6gsaywng5xc35ahznls3tjgg7z2ggepe 15000000uakt --from relayer --node=http://13.250.11.206:26657 --chain-id edgenet-1 --yes --fees=5000uakt

task/tap-agoric-faucet: hermes.config
	@echo tapping agoric faucet
	@echo agoric address $(ADDR_AG)
	agd --home=../_agstate/keys tx bank send -ojson --keyring-backend=test --gas=auto --gas-adjustment=1.2 --broadcast-mode=block --yes --chain-id=agoric --node=tcp://localhost:26657 provision $(ADDR_AG) 13000000ubld,50000000urun
	mkdir -p task && touch $@
