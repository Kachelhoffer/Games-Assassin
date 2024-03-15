const fs = require('fs');
const path = require('path');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => readline.question(query, resolve));

const mainMenu = async () => {
    const choice = await askQuestion('Do you want to start a new game or continue an existing game? (1 for New, 2 for Existing): ');
    switch (choice) {
        case '1':
            await startNewGame();
            break;
        case '2':
            await continueGame();
            break;
        default:
            console.log('Invalid option. Please type "1" for New or "2" for Existing.');
            await mainMenu();
            break;
    }
};

const startNewGame = async () => {
    const gameName = await askQuestion('Enter game name: ');

    const inputMethod = await askQuestion('Choose an option: 1. Enter Names manually 2. Import from CSV: ');

    const players = [];

    if (inputMethod === '1') {
        // Manually enter names
        let playerName = '';
        while (playerName.toLowerCase() !== 'done') {
            playerName = await askQuestion("Enter player's name (type 'Done' to finish): ");
            if (playerName.toLowerCase() !== 'done' && playerName.trim() !== '') {
                players.push({ name: playerName, alive: true, kills: 0, victims: [], assassin: '', target: '' });
            }
        }
    } else if (inputMethod === '2') {
        // Assume the CSV file location
        const filePath = 'Players/players.csv';
        try {
            const data = fs.readFileSync(path.resolve(filePath), 'utf8');
            const names = data.split(',');
            names.forEach(name => {
                if (name.trim() !== '') {
                    players.push({ name: name.trim(), alive: true, kills: 0, victims: [], assassin: '', target: '' });
                }
            });
        } catch (err) {
            console.error('Error reading the file:', err);
            return; // Exit the function if file reading fails
        }
    } else {
        console.log('Invalid option. Returning to main menu.');
        return; // Exit the function if an invalid option is chosen
    }

    assignTargets(players);
    saveGame(gameName, players);
    await gameDashboard(gameName, players);
};



const continueGame = async () => {
    const gameName = await askQuestion('Enter game name: ');
    const players = loadGame(gameName);
    await gameDashboard(gameName, players);
};

// const assignTargets = (players) => {
//     for (let i = 0; i < players.length; i++) {
//         players[i].target = players[(i + 1) % players.length].name;
//     }
// };
const assignTargets = (players) => {
    // Randomize the order of players using a modern version of the Fisher-Yates shuffle
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]]; // ES6 array destructuring for swapping
    }

    // Assign targets in the randomized order, ensuring a circular loop
    for (let i = 0; i < players.length; i++) {
        players[i].target = players[(i + 1) % players.length].name;
    }
};


const saveGame = (gameName, players) => {
    // Ensure the directory exists
    if (!fs.existsSync('Games')) {
        fs.mkdirSync('Games');
    }

    // Save the game state to the specified file within the Games directory
    fs.writeFileSync(`Games/${gameName}.json`, JSON.stringify(players, null, 2));
};

const loadGame = (gameName) => {
    // Reads the game data from a file within the 'Games' directory
    try {
        return JSON.parse(fs.readFileSync(`Games/${gameName}.json`));
    } catch (err) {
        console.error(`Error loading the game: ${err.message}`);
        // Handle the error appropriately
        // This could include prompting the user again or exiting the function/game
    }
};

const gameDashboard = async (gameName, players = []) => {
    let running = true;

    while (running) {
        console.log('\nGame Dashboard:');
        const choice = await askQuestion('Choose an option:\n 1. Leaderboard \n 2. Record a kill \n 3. Display Game Tree \n 4. End Game: \n');

        switch (choice) {
            case '1':
                await displayLeaderboard(players);
                break;
            case '2':
                players = await recordKill(players, gameName);
                saveGame(gameName, players);
                break;
            case '3':
                await displayGameTree(players);
                break;
            case '4':
                console.log('Ending game...');
                running = false;
                break;
            default:
                console.log('Invalid option, please choose 1, 2, 3, or 4.');
                break;
        }
    }
};

const displayGameTree = async (players) => {
    // Find the first alive player to start the chain
    const firstAlivePlayer = players.find(p => p.alive);
    if (!firstAlivePlayer) {
        console.log("No alive players to display.");
        return;
    }

    let current = firstAlivePlayer;
    let gameTree = `${current.name}`;
    let next = players.find(p => p.name === current.target && p.alive);

    // Loop through the targets until we circle back to the first player
    while (next && next.name !== firstAlivePlayer.name) {
        gameTree += ` -> ${next.name}`;
        current = next;
        next = players.find(p => p.name === current.target && p.alive);
    }

    // Completing the loop
    if (next) { // Ensure we add the first player again to show the loop is closed
        gameTree += ` -> ${next.name}`;
    }

    console.log(gameTree);

    console.log('\n');
    // Prompt the user to press any key or enter any input to continue.
    await askQuestion("Press enter or type any input to continue... \n");
};


const displayLeaderboard = async (players) => {
    console.log('\nLeaderboard:');
    // Sort players by their kills in descending order and display them.
    players.sort((a, b) => b.kills - a.kills).forEach(player => {
        console.log(`${player.name}: ${player.kills} kills`);
    });
    console.log('\n');
    // Prompt the user to press any key or enter any input to continue.
    await askQuestion("Press enter or type any input to continue... \n");
    
    // After receiving input, the function will exit, allowing the program to continue.
};


const recordKill = async (players) => {
    const assassinName = await askQuestion("Enter Assassin's name: ");
    const victimName = await askQuestion("Enter Victim's name: ");

    const assassin = players.find(player => player.name === assassinName && player.alive);
    const victim = players.find(player => player.name === victimName && player.alive);

    if (assassin && victim) {
        if(assassin.target !== victim.name)
        {
            console.log(`${assassinName} is not allowed to kill ${victimName}.`);
        }
        else{
            assassin.kills += 1;
            assassin.victims.push(victimName); // Record the victim in assassin's list.
            assassin.target = victim.target;
            victim.alive = false;
            victim.assassin = assassinName; // Store the assassin for the victim.
            victim.target = "";
            console.log(`${assassinName} has successfully eliminated ${victimName}.`);
            console.log(`${assassinName}'s new target is: ${assassin.target}.`);
        }
        
    } else {
        console.log("Invalid names or player(s) not found or already eliminated. Please try again.");
    }

    return players;
};

// Ensure the functions 'saveGame' and 'loadGame' are correctly implemented to handle file operations.


mainMenu().then(() => readline.close());
