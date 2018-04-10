var RockPaperScissorsGame = artifacts.require("./RockPaperScissorsGame.sol");
const Promise = require("bluebird");
Promise.promisifyAll(web3.eth, { suffix: "Promise" });

contract("RockPaperScissorsGame", function(accounts){
	// Declare test variables here
	var gameContract;
	var owner 	= accounts[0];
	var alice 	= accounts[1];
	var bob 	= accounts[2];
	var carol 	= accounts[3];

	var aliceSecretHash, bobSecretHash;
	var aliceSecretMove, bobSecretMove;

	const betAmount = web3.toWei(0.01, "ether");
	const winnerBalanceAmount = web3.toWei(0.02, "ether");
	const Move 	= Object.freeze({ "None" : 0, "Rock": 1, "Paper": 2, "Scissors": 3 });
	const State = Object.freeze({ "Open" : 0, "Started": 1, "Reveal": 2 });

	// Set the initial test state before running each test
	beforeEach("deploy new RockPaperScissorsGame instance and generate secret hash.", function(){
		return RockPaperScissorsGame.new(true, { from: owner })
		.then(function(instance){
			gameContract = instance;
			return gameContract.hashSecret("password1");
		})
		.then(function(_secret){
			aliceSecretHash = _secret;
			return gameContract.hashSecret("password2");
		})
		.then(function(_secret){
			bobSecretHash = _secret;
			return gameContract.hashMove(Move.Rock, aliceSecretHash);
		})
		.then(function(_secretMove){
			aliceSecretMove = _secretMove;
			return gameContract.hashMove(Move.Scissors, bobSecretHash);
		})
		.then(function(_secretMove){
			bobSecretMove = _secretMove;
		});
	});

	// Write tests here
	describe("Game Open", function(){
		it("should allow Alice to start the game when state is open.", function(){
			return gameContract.startGame(betAmount, { from: alice })
			.then(function(txn){
				// Check game started event is logged
				assert.strictEqual(txn.logs.length, 1, "Game started event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogGameStartedState", "Event logged is not a LogGameStartedState event.");
				assert.strictEqual(txn.logs[0].args.gameState.toNumber(10), State.Started, "Wrong state.");
				assert.strictEqual(txn.logs[0].args.hostPlayerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[0].args.currentBet.toString(10), betAmount, "Wrong bet amount.");
			});
		});

		it("should allow Alice to deposit funds when state is open.", function(){
			return gameContract.deposit({ from: alice, value: betAmount })
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, "Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a LogDeposit event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), betAmount, "Wrong amount.");
				return gameContract.getPlayerBalance(alice);
			})
			.then(function(_playerBalance){
				assert.strictEqual(_playerBalance.toString(10), betAmount, "Wrong player balance.");
			});
		});
	});

	describe("Game Started", function(){
		beforeEach("start game and deposit funds.", function(){
			return gameContract.startGame(betAmount, { from: alice })
			.then(function(txn){
				// Check game started event is logged
				assert.strictEqual(txn.logs.length, 1, "Game started event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogGameStartedState", "Event logged is not a LogGameStartedState event.");
				assert.strictEqual(txn.logs[0].args.gameState.toNumber(10), State.Started, "Wrong state.");
				assert.strictEqual(txn.logs[0].args.hostPlayerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[0].args.currentBet.toString(10), betAmount, "Wrong bet amount.");
				return gameContract.deposit({ from: alice, value: betAmount });
			})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, "Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a LogDeposit event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), betAmount, "Wrong amount.");
			});
		});

		it("should allow Alice to submit secret move when state is started.", function(){
			return gameContract.sendMove(aliceSecretMove, { from: alice })
			.then(function(txn){
				// Check send move event is logged
				assert.strictEqual(txn.logs.length, 1, "Send move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogSendMove", "Event logged is not a LogSendMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.secretMove, aliceSecretMove, "Wrong secret move.");
			});
		});

		it("should allow Bob to submit secret move as opponent when state is started.", function(){
			return gameContract.sendMove(aliceSecretMove, { from: alice })
			.then(function(txn){
				// Check send move event is logged
				assert.strictEqual(txn.logs.length, 1, "Send move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogSendMove", "Event logged is not a LogSendMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.secretMove, aliceSecretMove, "Wrong secret move.");

				return gameContract.deposit({ from: bob, value: betAmount });
			})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, "Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a LogDeposit event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, bob, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), betAmount, "Wrong amount.");

				return gameContract.sendMove(bobSecretMove, { from: bob });
			})
			.then(function(txn){
				// Check send move event is logged
				assert.strictEqual(txn.logs.length, 2, "Send move event and reveal state event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogSendMove", "Event logged is not a LogSendMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, bob, "Wrong opponent address.");
				assert.strictEqual(txn.logs[0].args.secretMove, bobSecretMove, "Wrong opponent secret move.");

				// Check reveal state event is logged
				assert.strictEqual(txn.logs[1].event, "LogGameRevealState", "Event logged is not a LogGameRevealState event.");
				assert.strictEqual(txn.logs[1].args.gameState.toNumber(10), State.Reveal, "Wrong state.");
				assert.strictEqual(txn.logs[1].args.hostPlayerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[1].args.hostSecretMove, aliceSecretMove, "Wrong host secret move.");
				assert.strictEqual(txn.logs[1].args.opponentPlayerAddress, bob, "Wrong opponent player address.");
				assert.strictEqual(txn.logs[1].args.opponentSecretMove, bobSecretMove, "Wrong opponent secret move.");
			});
		});
	});

	describe("Game Reveal", function(){
		beforeEach("start game, deposit funds and send in moves for both players.", function(){
			return gameContract.startGame(betAmount, { from: alice })
			.then(function(txn){
				// Check game started event is logged
				assert.strictEqual(txn.logs.length, 1, "Game started event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogGameStartedState", "Event logged is not a LogGameStartedState event.");
				assert.strictEqual(txn.logs[0].args.gameState.toNumber(10), State.Started, "Wrong state.");
				assert.strictEqual(txn.logs[0].args.hostPlayerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[0].args.currentBet.toString(10), betAmount, "Wrong bet amount.");
				return gameContract.deposit({ from: alice, value: betAmount });
			})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, "Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a LogDeposit event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), betAmount, "Wrong amount.");

				return gameContract.deposit({ from: bob, value: betAmount });
			})
			.then(function(txn){
				// Check deposit event is logged
				assert.strictEqual(txn.logs.length, 1, "Deposit event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogDeposit", "Event logged is not a LogDeposit event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, bob, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.amount.toString(10), betAmount, "Wrong amount.");

				return gameContract.sendMove(aliceSecretMove, { from: alice })
			})
			.then(function(txn){
				// Check send move event is logged
				assert.strictEqual(txn.logs.length, 1, "Send move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogSendMove", "Event logged is not a LogSendMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong player address.");
				assert.strictEqual(txn.logs[0].args.secretMove, aliceSecretMove, "Wrong secret move.");

				return gameContract.sendMove(bobSecretMove, { from: bob });
			})
			.then(function(txn){
				// Check send move event is logged
				assert.strictEqual(txn.logs.length, 2, "Send move event and reveal state event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogSendMove", "Event logged is not a LogSendMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, bob, "Wrong opponent address.");
				assert.strictEqual(txn.logs[0].args.secretMove, bobSecretMove, "Wrong opponent secret move.");

				// Check reveal state event is logged
				assert.strictEqual(txn.logs[1].event, "LogGameRevealState", "Event logged is not a LogGameRevealState event.");
				assert.strictEqual(txn.logs[1].args.gameState.toNumber(10), State.Reveal, "Wrong state.");
				assert.strictEqual(txn.logs[1].args.hostPlayerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[1].args.hostSecretMove, aliceSecretMove, "Wrong host secret move.");
				assert.strictEqual(txn.logs[1].args.opponentPlayerAddress, bob, "Wrong opponent player address.");
				assert.strictEqual(txn.logs[1].args.opponentSecretMove, bobSecretMove, "Wrong opponent secret move.");
			});
		});

		it("should allow Alice to reveal the move when state is reveal.", function(){
			return gameContract.revealMove(aliceSecretHash, { from: alice })
			.then(function(txn){
				// Check reveal move event is logged
				assert.strictEqual(txn.logs.length, 1, "Send reveal move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRevealMove", "Event logged is not a LogRevealMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[0].args.decodedMove.toNumber(10), Move.Rock, "Wrong host player decoded move.");
				assert.strictEqual(txn.logs[0].args.secretMove, aliceSecretMove, "Wrong host secret move.");
			});
		});

		it("should allow Bob to reveal the move when state is reveal and game should announce winner as Alice.", function(){
			return gameContract.revealMove(aliceSecretHash, { from: alice })
			.then(function(txn){
				// Check reveal move event is logged
				assert.strictEqual(txn.logs.length, 1, "Send reveal move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRevealMove", "Event logged is not a LogRevealMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, alice, "Wrong host player address.");
				assert.strictEqual(txn.logs[0].args.decodedMove.toNumber(10), Move.Rock, "Wrong host player decoded move.");
				assert.strictEqual(txn.logs[0].args.secretMove, aliceSecretMove, "Wrong host secret move.");

				return gameContract.revealMove(bobSecretHash, { from: bob });
			})
			.then(function(txn){
				// Check reveal move event is logged
				assert.strictEqual(txn.logs.length, 5, "Send reveal move event is not emitted.");
				assert.strictEqual(txn.logs[0].event, "LogRevealMove", "Event logged is not a LogRevealMove event.");
				assert.strictEqual(txn.logs[0].args.playerAddress, bob, "Wrong opponent player address.");
				assert.strictEqual(txn.logs[0].args.decodedMove.toNumber(10), Move.Scissors, "Wrong opponent player decoded move.");
				assert.strictEqual(txn.logs[0].args.secretMove, bobSecretMove, "Wrong opponent secret move.");

				// Check winner event is logged
				assert.strictEqual(txn.logs[1].event, "LogWinner", "Event logged is not a LogWinner event.");
				assert.strictEqual(txn.logs[1].args.winnerAddress, alice, "Wrong winner player address.");
				assert.strictEqual(txn.logs[1].args.winnerMove.toNumber(10), Move.Rock, "Wrong winner player move.");
				assert.strictEqual(txn.logs[1].args.winnerBalance.toString(10), winnerBalanceAmount, "Wrong winner player balance.");
				assert.strictEqual(txn.logs[1].args.loserAddress, bob, "Wrong loser player address.");
				assert.strictEqual(txn.logs[1].args.loserMove.toNumber(10), Move.Scissors, "Wrong loser player move.");
				assert.strictEqual(txn.logs[1].args.loserBalance.toNumber(10), 0, "Wrong loser player balance.");
			});
		});
	});
});