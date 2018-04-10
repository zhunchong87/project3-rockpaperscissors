pragma solidity ^0.4.17;
import "./Stoppable.sol";

contract RockPaperScissorsGame is Stoppable{
	enum Move { None, Rock, Paper, Scissors }
	enum State { Open, Started, Reveal }

	mapping(address => PlayerStruct) private players;
	State private gameState;
	uint private currentBet;
	address private hostPlayerAddress;
	address private opponentPlayerAddress;

	struct PlayerStruct{
		mapping(bytes32 => bool) pastSecretMoves;
		bytes32 currentSecretMove;
		Move currentMove;
		uint balance;
	}

	modifier onlyGameOpen    () { require(gameState == State.Open);    _; }
    modifier onlyGameStarted () { require(gameState == State.Started); _; }
    modifier onlyGameReveal  () { require(gameState == State.Reveal);  _; }

    event LogGameOpenState(State gameState, uint currentBet, address hostPlayerAddress, address opponentPlayerAddress);
    event LogGameStartedState(State gameState, address indexed hostPlayerAddress, uint currentBet);
    event LogGameRevealState(State gameState, address indexed hostPlayerAddress, bytes32 hostSecretMove, address indexed opponentPlayerAddress, bytes32 opponentSecretMove);

    event LogSendMove(address indexed playerAddress, bytes32 secretMove);
    event LogRevealMove(address indexed playerAddress, Move decodedMove, bytes32 secretMove);
    event LogResetMove(address indexed playerAddress, Move decodeMove, bytes32 secretMove);

    event LogWinner(address indexed winnerAddress, Move winnerMove, uint winnerBalance, address indexed loserAddress, Move loserMove, uint loserBalance);
    event LogTie(address indexed hostAddress, Move hostMove, uint hostBalance, address indexed opponentAddress, Move opponentMove, uint opponentBalance);

    event LogDeposit(address indexed playerAddress, uint amount);
    event LogWithdraw(address indexed playerAddress, uint amount);

	function RockPaperScissorsGame(bool isActive)
		Stoppable(isActive)
		public
	{
		resetToOpenState();
	}

	/*
		Game State: Open => Started
		Start the game. Set the bet amount and host/first player.
	*/
	function startGame(uint betAmount)
		public
		onlyGameOpen
		onlyActive
	{
		require(betAmount > 0);

		currentBet = betAmount;
		hostPlayerAddress = msg.sender;
		gameState = State.Started;

		LogGameStartedState(gameState, hostPlayerAddress, currentBet);
	}

	/*
		Game State: Started => Reveal
		Player can send in their secret move.
	*/
	function sendMove(bytes32 secretMove)
		public
		onlyGameStarted
		onlyActive
	{
		// Ensure that player has sufficient balance for betting.
		require(players[msg.sender].balance >= currentBet);

		// Ensure that player has not used this secret move before.
		require(!players[msg.sender].pastSecretMoves[secretMove]);

		players[msg.sender].currentSecretMove = secretMove;
		LogSendMove(msg.sender, secretMove);

		// Check if this is another player sending in their move for challenging the bet.
		if(msg.sender != hostPlayerAddress){
			// If it is, then proceed to the reveal state. 
			// Wait for players to send in their secretHash for decoding the moves.
			opponentPlayerAddress = msg.sender;
			gameState = State.Reveal;
			LogGameRevealState(gameState, 
				hostPlayerAddress, players[hostPlayerAddress].currentSecretMove, 
				opponentPlayerAddress, players[opponentPlayerAddress].currentSecretMove);
		}
	}

	/*
		Game State: Reveal => Open
		Player send in their secretHash for contract to process the winner.
	*/
	function revealMove(bytes32 secretHash)
		public
		onlyGameReveal
		onlyActive
	{
		// Check that only the participants may reveal the moves.
		require(msg.sender == hostPlayerAddress || msg.sender == opponentPlayerAddress);

		// Check that the move have not been revealed before. 
		require(players[msg.sender].currentMove == Move.None);

		Move decodedMove = decodeMove(players[msg.sender].currentSecretMove, secretHash);

		// If no valid moves is found, secretHash is incorrect.
		require(decodedMove != Move.None);
		players[msg.sender].currentMove = decodedMove;
		LogRevealMove(msg.sender, decodedMove, players[msg.sender].currentSecretMove);

		// Register the secretHash so that the player will not be able to reuse the secret.
		registerPastSecretMoves(msg.sender, secretHash);

		// Check if both players has reveal the moves
		if(players[hostPlayerAddress].currentMove != Move.None 
			&& players[opponentPlayerAddress].currentMove != Move.None){
			computeWinner();
		}
	}

	/*
		Private function to register the past secretHash
	*/
	function registerPastSecretMoves(address playerAddress, bytes32 secretHash)
		private
	{
		// Register all 3 types of moves so that the secretHash could not be reuse.
		players[playerAddress].pastSecretMoves[hashMove(Move.Rock, secretHash)] = true;
		players[playerAddress].pastSecretMoves[hashMove(Move.Paper, secretHash)] = true;
		players[playerAddress].pastSecretMoves[hashMove(Move.Scissors, secretHash)] = true;
	}

	/*
		Private function to compute the winner
	*/
	function computeWinner()
		private
	{
		Move hostMove = players[hostPlayerAddress].currentMove;
		Move opponentMove = players[opponentPlayerAddress].currentMove;
		
		if((hostMove == Move.Rock && opponentMove == Move.Scissors)
			|| (hostMove == Move.Paper && opponentMove == Move.Rock)
			|| (hostMove == Move.Scissors && opponentMove == Move.Paper)){
			
			// Host Win
			players[hostPlayerAddress].balance += currentBet;
			players[opponentPlayerAddress].balance -= currentBet;

			LogWinner(hostPlayerAddress, hostMove, players[hostPlayerAddress].balance, 
			opponentPlayerAddress, opponentMove, players[opponentPlayerAddress].balance);
		}
		else if((hostMove == Move.Rock && opponentMove == Move.Paper)
			|| (hostMove == Move.Paper && opponentMove == Move.Scissors)
			|| (hostMove == Move.Scissors && opponentMove == Move.Rock)){
			
			// Opponent Win
			players[opponentPlayerAddress].balance += currentBet;
			players[hostPlayerAddress].balance -= currentBet;

			LogWinner(opponentPlayerAddress, opponentMove, players[opponentPlayerAddress].balance, 
			hostPlayerAddress, hostMove, players[hostPlayerAddress].balance);
		}
		else{
			// Tie: Do nothing
			LogTie(hostPlayerAddress, hostMove, players[hostPlayerAddress].balance, 
			opponentPlayerAddress, opponentMove, players[opponentPlayerAddress].balance);
		}

		// Reset game state
		resetPlayerMoves(hostPlayerAddress);
		resetPlayerMoves(opponentPlayerAddress);
		resetToOpenState();
	}

	/*
		Private function to reset the player's moves
	*/
	function resetPlayerMoves(address playerAddress)
		private
	{
		players[playerAddress].currentSecretMove = "";
		players[playerAddress].currentMove = Move.None;

		LogResetMove(playerAddress, players[playerAddress].currentMove, players[playerAddress].currentSecretMove);
	}

	/*
		Players can deposit funds into their betting account.
	*/
	function deposit()
		public
		payable
		onlyActive
	{
		require(msg.value > 0);
		players[msg.sender].balance += msg.value;

		// Log deposit event
		LogDeposit(msg.sender, msg.value);
	}

	/*
		Players can withdraw funds from their betting account.
	*/
	function withdraw()
		public
		onlyGameOpen
		onlyActive
	{
		require(players[msg.sender].balance > 0);

		uint withdrawAmt = players[msg.sender].balance;
		players[msg.sender].balance = 0;
		// Log withdraw event
		LogWithdraw(msg.sender, withdrawAmt);

		msg.sender.transfer(withdrawAmt);
	}

	/*
		Owner is able to reset the game
	*/
	function resetGame()
		public
		onlyOwner
	{
		if(hostPlayerAddress != address(0)){
			resetPlayerMoves(hostPlayerAddress);
		}

		if(opponentPlayerAddress != address(0)){
			resetPlayerMoves(opponentPlayerAddress);
		}

		resetToOpenState();
	}

	/*
		Private function for resetting the game state back to Open
	*/
	function resetToOpenState()
		private
	{
		gameState = State.Open;
		currentBet = 0;
		hostPlayerAddress = address(0);
		opponentPlayerAddress = address(0);

		LogGameOpenState(gameState, currentBet, hostPlayerAddress, opponentPlayerAddress);
	}

	// Getters / Setters
	function getGameState()
		public
		view
		returns (State)
	{
		return gameState;
	}

	function getCurrentBet()
		public
		view
		returns (uint)
	{
		return currentBet;
	}

	function getHostPlayerAddress()
		public
		view
		returns (address)
	{
		return hostPlayerAddress;
	}

	function getOpponentPlayerAddress()
		public
		view
		returns (address)
	{
		return opponentPlayerAddress;
	}

	function getPlayerBalance(address playerAddress)
		public
		view
		returns (uint)
	{
		return players[playerAddress].balance;
	}

	/*
		Utility Functions for decoding and hashing secret moves.
	*/
	function hashSecret(bytes32 secret)
		public
		pure
		returns (bytes32)
	{
		return keccak256(secret);
	}

	function hashMove(Move move, bytes32 secretHash)
		public
		pure
		returns (bytes32)
	{
		return keccak256(move, secretHash);
	}
	
	function decodeMove(bytes32 secretMove, bytes32 secretHash)
		private
		pure
		returns (Move)
	{
		if(secretMove == hashMove(Move.Rock, secretHash)){
			return Move.Rock;
		}
		else if(secretMove == hashMove(Move.Paper, secretHash)){
			return Move.Paper;
		}
		else if(secretMove == hashMove(Move.Scissors, secretHash)){
			return Move.Scissors;
		}
		else{
			return Move.None;
		}
	}

	/*
	 	Do not accept any funds from other sources.
	*/
	function() public payable{ revert(); }
}