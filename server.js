// Require Modules
var http = require('http'),
	fs = require('fs'),
	path = require('path'),
	io = require('socket.io');

// Connections
var connections = [];
var users = [];	

// Create Server
var server = http.createServer(function(req, res){

	// Log request method and url
	console.log(`${req.method} for ${req.url}`);

	// Match Hope Page
	if ( req.url === "/" ){
		fs.readFile("./public/index.html", "UTF-8", function(err, html){
			res.writeHead(200, {"Content-Type": "text/html"});
			res.end(html);
		});

	// Match CSS File
	} else if ( req.url.match(/.css$/) ){
		var cssPath = path.join(__dirname, 'public', req.url);
		var fileStream = fs.createReadStream(cssPath, "UTF-8");
		res.writeHead(200, {"Content-Type": "text/css"});
		fileStream.pipe(res);

	// Match JS File	
	} else if ( req.url.match(/.js$/) ){
		var jsPath = path.join(__dirname, 'public', req.url);
		var fileStream = fs.createReadStream(jsPath, "UTF-8");
		res.writeHead(200, {"Content-Type": "text/js"});
		fileStream.pipe(res);		

	// 404 File Not Found
	} else {
		res.writeHead(404, {"Content-Type": "text/plain"});
		res.end("404 - Not Found");
	}

});

// Setup server to listen on port 3000
server.listen(3000, function(){
	console.log("Server listening on Port 3000");
});

// Listen for web sockets
io = io.listen(server);

io.sockets.on('connection', function(socket){

	// Pool socket on connect
	connections.push(socket);
	console.log(`Connected: ${connections.length} sockets connected`);

	// Drop socket on disconnect
	socket.on('disconnect', function(){
		connections.splice(connections.indexOf(socket), 1);
		if(this.nickName){
			console.log(`${this.nickName} disconnected!`);
		}
		console.log(`Disconnected: ${connections.length} sockets connected`);
		if(socket.game){
			delete socket.game;
		}
	});

	// Add player and set the player to a ready state
	socket.on("ready", function(data){
		console.log(`${data.nickname} is ready!`);
		socket.nickName = data.nickname;
		socket.lookingForMatch = true;
	});

});

// Loop through connections and setup matches
(function matchPlayers(){
	if(connections.length >= 2){
		for(var i=0; i<connections.length; i++){
			if(!connections[i].lookingForMatch){ continue };
			for(var j = i+1; j<connections.length; j++){
				if(connections[i].lookingForMatch && connections[j].lookingForMatch){
					console.log(`${connections[i].nickName} is going to play against ${connections[j].nickName}.`);
					connections[i].lookingForMatch=false;
					connections[j].lookingForMatch=false;
					// Start Game
					startGame(connections[i], connections[j]);
				}
			}
		}
		setTimeout(matchPlayers, 300);
	} else {
		setTimeout(matchPlayers, 300);
	}
})();

// player1 and player2 are the sockets
function startGame(player1, player2){
	// construct game
	player1.game = new Game(player1, player2);
	player2.game = player1.game;

}

var Snake = (function(){

	// Snake Constructor
	function Snake(playerNumber){
		this.body = [];
		this.color = {
			green: ["#007f00", "#00ff00", "#66FF66"],
			red: ["#9A0707","#F93A3f","#FB7478"]
		};
		this.dir = 1;     //Moving Direction (1=up,2=right,3=down,4=left)
		this.player = playerNumber;
		this.score = 100;
		this.hitSelf = false;  //turns true when you run into your own body
		this.died = false; //turns true when you run inot other snake
	}

	Snake.prototype.startBody = function(){
		if(this.player == 1){
			// starts facing up
			this.dir = 1;
			this.addBodyPart(200,300);
			this.addBodyPart(200,320);
			this.addBodyPart(200,340);
			this.addBodyPart(200,360);
		} else if (this.player == 2){
			// starts facing down
			this.dir = 3;
			this.addBodyPart(800,360);
			this.addBodyPart(800,340);
			this.addBodyPart(800,320);
			this.addBodyPart(800,300);
		}
	}

	// Add body part block
	Snake.prototype.addBodyPart = function(x,y){
		this.body.push({
			xpos: x,
			ypos: y
		})
	};

	// move the snake 1 space in the current direction
	// if the space we moved to has a peice of food, extend the length by 1
	Snake.prototype.move = function(){
		var newBody = [];
		switch(this.dir){
			case 1: // Move up
				newBody.push({
					xpos: this.body[0].xpos,
					ypos: (this.body[0].ypos>0)?this.body[0].ypos-20:680
				});
				break;
			case 2: // Move right
				newBody.push({
					xpos: (this.body[0].xpos<980)?this.body[0].xpos+20:0,
					ypos: this.body[0].ypos
				});
				break;
			case 3: // Move down
				newBody.push({
					xpos: this.body[0].xpos,
					ypos: (this.body[0].ypos<680)?this.body[0].ypos+20:0
				});
				break;
			case 4: // Move left 
				newBody.push({
					xpos: (this.body[0].xpos>0)?this.body[0].xpos-20:980,
					ypos: this.body[0].ypos
				});
			break;
		}

		// Test for food collision
		for(var i =0; i<Food.set.length; i++){
			if(this.testCollision(newBody[0].xpos,newBody[0].ypos,Food.set[i].x,Food.set[i].y)){
				this.extend = true;
				Food.set.splice(i,1); // remove food since it was eatten
				this.score += 25;
				break;
			}
		}

		var dead = false;
		for(var i=1; i<this.body.length; i++){
			dead = this.testCollision(
				newBody[0].xpos,
				newBody[0].ypos,
				this.body[i].xpos,
				this.body[i].ypos
			);
			if(dead){
				this.hitSelf = true;
				break;
			}
		}

		// extend snake length if food is eaten
		if(this.extend){
			this.body.unshift({
				xpos: newBody[0].xpos,
				ypos: newBody[0].ypos
			});
			this.extend=false;
		} else {
			var part = 1;
			while(part<this.body.length){
				newBody[part] = {
					xpos: this.body[part-1].xpos,
					ypos: this.body[part-1].ypos
				};
				part++;
			}
			this.body = newBody;
		}



	};

	Snake.prototype.testCollision = function(x1,y1,x2,y2){
		return (x1 === x2 && y1 === y2)?true:false;
	}

	return Snake;
})();

var Game = (function(){

	// Basic Constructor
	function Game(socketp1, socketp2){
		this.socketp1 = socketp1;
		this.socketp2 = socketp2;
		this.preload();
	}

	Game.prototype.preload = function(){
		var that = this;
		this.running = false;
		this.snakep1 = new Snake(1);
		this.snakep2 = new Snake(2);

		// snakes gotta have food to grow
		this.food = new Food();
		this.food.addFood();    // gotta make sure we have at least 1 food when game starts

		this.snakep1.startBody();
		this.snakep2.startBody();
		this.socketp1.emit('start game', {
			p1: {
				name: this.socketp1.nickName,
				body: this.snakep1.body,
				color: this.snakep1.color.green
			},
			p2: {
				name: this.socketp2.nickName,
				body: this.snakep2.body,
				color: this.snakep2.color.red
			},
			foodset: this.food.set,
			foodColors: this.food.colors
		});
		this.socketp2.emit('start game', {
			p1: {
				name: this.socketp2.nickName,
				body: this.snakep1.body,
				color: this.snakep1.color.red
			},
			p2: {
				name: this.socketp1.nickName,
				body: this.snakep2.body,
				color: this.snakep2.color.green
			},
			foodset: this.food.set,
			foodColors: this.food.colors
		});
		//listen for response
		this.listenForDirChange();
		this.socketp1.on("go", function(){
			if(!that.running){
				that.running = true;
				that.runEventLoop();
			}
		});
		this.socketp2.on("go", function(){
			if(!that.running){
				that.running = true;
				that.runEventLoop();
			}			
		});
		this.socketp1.on("get data", function(){
			that.socketp1.emit("paint data", {
				p1body: that.snakep1.body,
				p2body: that.snakep2.body,
				foodset: that.food.set
			});
		});
		this.socketp2.on("get data", function(){
			that.socketp2.emit("paint data", {
				p1body: that.snakep1.body,
				p2body: that.snakep2.body,
				foodset: that.food.set				
			});
		});

	}

	// listen for input controls from user
	// the if else block keeps the snake from turning on its own body
	Game.prototype.listenForDirChange = function(){
		var that = this;
		this.socketp1.on("direction change", function(data){

			if(data.dir == 1 && that.snakep1.dir != 3){
				that.snakep1.dir = data.dir;
			} else if(data.dir == 2 && that.snakep1.dir != 4){
				that.snakep1.dir = data.dir;
			} else if(data.dir == 3 && that.snakep1.dir != 1){
				that.snakep1.dir = data.dir;
			} else if(data.dir == 4 && that.snakep1.dir != 2){
				that.snakep1.dir = data.dir;
			}

		});
		this.socketp2.on("direction change", function(data){

			if(data.dir == 1 && that.snakep2.dir != 3){
				that.snakep2.dir = data.dir;
			} else if(data.dir == 2 && that.snakep2.dir != 4){
				that.snakep2.dir = data.dir;
			} else if(data.dir == 3 && that.snakep2.dir != 1){
				that.snakep2.dir = data.dir;
			} else if(data.dir == 4 && that.snakep2.dir != 2){
				that.snakep2.dir = data.dir;
			}

		});

	}

	Game.prototype.runEventLoop = function(){
		var that = this;	
		var fps = 20;
		fps = 1000/fps;
		var timeStamp = Date.now();
		(function tick(){
			var now = Date.now();
			if((now-timeStamp)>fps){
				that.food.randomAdd();

				if(that.snakep1.hitSelf){
					that.socketp1.emit("hit self", {snake: 1, winner: that.socketp2.nickName});
					that.socketp2.emit("hit self", {snake: 1, winner: that.socketp2.nickName});
				} else if (that.snakep2.hitSelf){
					that.socketp1.emit("hit self", {snake: 2, winner: that.socketp1.nickName});
					that.socketp2.emit("hit self", {snake: 2, winner: that.socketp1.nickName});
				} else if (that.snakep2.died){
					that.socketp1.emit("hit self", {snake: 2, winner: that.socketp1.nickName});
					that.socketp2.emit("hit self", {snake: 2, winner: that.socketp1.nickName});
				} else if (that.snakep1.died){
					that.socketp1.emit("hit self", {snake: 1, winner: that.socketp2.nickName});
					that.socketp2.emit("hit self", {snake: 1, winner: that.socketp2.nickName});
				} else {
					that.snakep1.move();
					that.snakep2.move();
					that.checkSnakeCollision();
				}
				timeStamp = Date.now();
			}
			setTimeout(tick,10);
		})();
	}

	Game.prototype.checkSnakeCollision = function(){

		if(this.snakep1.testCollision(
				this.snakep1.body[0].xpos,
				this.snakep1.body[0].ypos,
				this.snakep2.body[0].xpos,
				this.snakep2.body[0].ypos
			)){
			if(this.snakep1.score > this.snakep2.score){
				this.snakep2.died = true;
				return;
			} else if (this.snakep2.score > this.snakep1.score){
				this.snakep1.died = true;
				return;
			}
		}


		for(var i=1; i<this.snakep2.body.length; i++){
			var s1died = this.snakep2.testCollision(
					this.snakep1.body[0].xpos,
					this.snakep1.body[0].ypos,
					this.snakep2.body[i].xpos,
					this.snakep2.body[i].ypos
				);
			if(s1died){
				this.snakep1.died = true;
				return;
			}
		}
		for(var i=1; i<this.snakep1.body.length; i++){
			var s2died = this.snakep1.testCollision(
					this.snakep2.body[0].xpos,
					this.snakep2.body[0].ypos,
					this.snakep1.body[i].xpos,
					this.snakep1.body[i].ypos
				);
			if(s2died){
				this.snakep2.died = true;
				return;
			}
		}
	}

	// return game
	return Game;

})();

var Food = (function(){

	// Basic Constructor
	function Food() {
		this.colors = ["#27AE60","#2880BA","#F39B26","#8E44AE"];
		this.set = Food.set = [];
	}

	// Adds a new peice of food to the map
	Food.prototype.addFood = function(){
		var that = this;
		(function addRandom(){
			// get a random x and y cord
			var tempx = Math.floor(Math.random()*50)*20;
			var tempy = Math.floor(Math.random()*35)*20;
			// test to see if a peice of food already exists at our random x and y
			// if food exists, try again
			for(var i = 0; i<Food.set.length; i++){
				if(tempx == Food.set[i].x && tempy == Food.set[i].y){
					addRandom();
				}
			}
			// if food doesnt exist, add it to the set of food
			// make the color of the food random
			Food.set.push({
				x: tempx,
				y: tempy,
				color: Math.floor(Math.random()*that.colors.length)
			});
		})()
	}

	// function that adds food to the map at a random pace
	Food.prototype.randomAdd = function(){
		var rand = Math.floor(Math.random()*100)+1;
		if(rand == 50){
			this.addFood();
		}
	}

	return Food;
})();






