const api = require('kahoot-api');
const readline = require('readline-sync');

const { Session, Adapters, Events } = api;

// State enum. Bad because js
var State = Object.freeze({ "cheat": 0, "kill": 1, "annoy": 2 });
var state = getState(process.argv.slice(2));

var gameStarted = false;
var gameID = readline.question("Enter Game ID ");
const session = new Session(gameID);

restart();

// Gets the state of the program
function getState(args) {
    switch (args[0]) {
        case "--cheat": {
            return State.cheat;
        }
        case "--kill": {
            return State.kill;
        }
        case "--annoy": {
            return State.annoy;
        }
        default: {
            console.log("Created by julianallchin for educational purpouses only\n");
            console.log("Arguments");
            console.log("\t--cheat: will attempt to find the correct answer")
            console.log("\t--kill: will make the game unplayable")
            console.log("\t--annoy: naughty names will double")

            process.exit();
            break;
        }
    }
}

// Enter name and join
function restart() {
    var name = readline.question("Enter Name ");

    if (state = State.annoy) {
        connect(name, true);
    } else {
        connect(name, false);
    }
}

// Connects to the game
function connect(name, bypass = false) {
    if (bypass) {
        name = bypassName(name);
    }

    session.openSocket().then(socket => {
        const player = new Adapters.Player(socket);

        player.join(name).then(() => {
            player.on('message', (message) => {
                switch (message.id) {
                    case Events.startQuiz: {
                        onStartQuiz(message, player);
                        gameStarted = true;
                        break;
                    }
                    case Events.getReady: {
                        onGetReady(message, player);
                        break;
                    }
                    case Events.userNameRejected: {
                        if (state == State.annoy) {
                            console.log("Name rejected by server. Leaving game.");
                            player.leave();
                            restart();
                        }
                    }
                    case Events.resetController: {
                        // If we didn't start the game, most likely we were kicked
                        if (!gameStarted) {

                            if (state == State.annoy) {
                                // Get the raw name
                                var rawName = name.toLowerCase().split('_')[0].replace('_', '');

                                // Try joining again but adding 1 to the iteration
                                connect(rawName, true);
                                connect(rawName, true);
                            }
                        }
                    }
                    default: {
                        break;
                    }
                }
            })

            // console.log("Connected!");
        });
    });
}

// Prevents name changing
function bypassName(name) {
    return name.toUpperCase() + '_' + Math.random().toString(36).substring(7);
}

// Run when a question is being prepared
function onGetReady(message, player) {
    switch (state) {
        case State.cheat:
            if (global.kahoot) {
                const { questionIndex } = message.content;

                const question = global.kahoot.questions[questionIndex];

                for (let i = 0; i < question.choices.length; i++) {
                    const choice = question.choices[i];

                    if (choice.correct) {
                        console.log("Answering " + '"' + choice.answer.replace(/<\/?[^>]+(>|$)/g, "") + '"');
                        player.answer(i);
                    }
                }
            }
            break;
    }
}

// Runs when the quiz starts
async function onStartQuiz(message, player) {
    const { quizName } = message.content;

    switch (state) {
        case State.cheat:
            getKahoot(quizName);
            break;
        case State.kill:
            lockdown(player, true);
            break;
        default:
            break;
    }

    return true;
}

// Searches for a kahoot with name
async function getKahoot(quizName) {
    console.log('Finding kahoots with name "' + quizName + '"...');
    session.web.searchKahoots(quizName).then(async kahoots => {

        var kahootIndex = 0;
        var correctKahoot = false;

        while (!correctKahoot) {
            console.log("----------------------")
            console.log("Found kahoot!")

            var uuid = kahoots.entities[kahootIndex].card.uuid

            let kahoot = await session.web.getKahoot(uuid);

            console.log("Got questions")
            console.log("Question 1: " + kahoot.questions[0].question)

            var correct = readline.keyInYN("Correct?");

            if (correct) {
                correctKahoot = true;
                global.kahoot = kahoot;
                console.log("\nStarting...");
            }

            kahootIndex++;
        }
    });
}

// Destroys the game
function lockdown(player, autoAnswer = false, interval = 100) {
    var index = 0;
    this.intervalId = setInterval(() => {
        player.send("/service/controller", {
            name: player.name,
            type: "login",
            status: "VERIFIED"
        });

        if (autoAnswer) {
            const choice = Math.floor(Math.random() * 4);
            player.answer(choice);
            index++;
            process.stdout.write("Jammed: " + index + " times\r");
        }

        player.send("/service/controller", {
            cid: player.cid,
            type: "left"
        });
    }, interval);
}