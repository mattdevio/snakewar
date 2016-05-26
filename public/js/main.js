(function(window,document,undefined){

	// Connect Socket
	var socket = io.connect();

	// Login with nickname form
	// sends the name of the user to the server
	// the user is placed in a looking for game state
	var nameForm = document.getElementById("nameform");
	var nickNameInput = document.getElementById("nickname");
	var nameFormOverlay = document.querySelector(".overlay");
	nickNameInput.focus(); // focus on load
	nameForm.addEventListener("submit", function(event){
		event.preventDefault();
		var nickName = nickNameInput.value.trim();
		// reset & hide form
		if(nickName != ""){
			nickNameInput.value = "";
			nameFormOverlay.style.display = "none";
			socket.emit("ready", {
				nickname: nickName
			});
			// run finding match animation
			findingMatch();
		} else {
			// name can't be blank
			nickNameInput.value = "";
			nickNameInput.focus();
		}
	});

	// simple animation to let the user know that a match is being searched for
	function findingMatch(){
		window.matchmeOverlay = document.querySelector(".matchme");
		matchmeOverlay.style.display = "block";
		var matchme = document.querySelector(".matchme h3");
		var count = 0;
		window.matchAnimation = setInterval(function(){
			count = (count == 3)? 0: count + 1;
			switch(count){
				case 0:
					matchme.innerHTML = "Looking For Match";
					break;
				case 1:
					matchme.innerHTML = "Looking For Match.";
					break;
				case 2: 
					matchme.innerHTML = "Looking For Match..";
					break;
				case 3:
					matchme.innerHTML = "Looking For Match...";
					break;
			}
		},200);
	};

	// Event START GAME is sent from the server when a match is found
	// this sets up all of the information
	socket.on("start game", function(data){

		// Stop the finding match animation and hide its overlay
		window.clearInterval(matchAnimation);
		matchmeOverlay.style.display = "none";
		// display names on scoreboard
		document.getElementById("p1").innerHTML = "<b>You:</b> "+data.p1.name;
		document.getElementById("p2").innerHTML = "<b>Enemy:</b> "+data.p2.name;
		// instantiate map object
		window.field = new Field();
		// instantiate snake objects
		socket.p1 = new Snake();
		socket.p2 = new Snake();

		// bind names
		socket.p1.name = data.p1.name;
		socket.p2.name = data.p2.name;

		// set their color
		socket.p1.color = data.p1.color;
		socket.p2.color = data.p2.color;

		// set their initial body position
		socket.p1.body = data.p1.body;
		socket.p2.body = data.p2.body;

		socket.food = new Food();
		socket.food.set = data.foodset
		socket.food.colors = data.foodColors;

		// draw map and initial part of both snakes and food
		field.draw();
		socket.p1.draw();
		socket.p2.draw();
		socket.food.draw();

		// listen for paint data
		// paint data includes boy position of snakes
		socket.on("paint data", function(data){
			socket.p1.body = data.p1body;
			socket.p2.body = data.p2body;
			socket.food.set = data.foodset;
		});

		var opacity = 1;
		socket.on("hit self", function(data){
			socket.winner = data.winner;
			if(data.snake == 1 ){
				socket.p1.fadeout = true;
			} else if (data.snake == 2){
				socket.p2.fadeout = true;
			}
		});

		// start coundown
		countDown(function(){
			socket.emit("go");
			socket.p1.emitControls(socket);
			(function drawFrame(){
				var drawFrames = window.requestAnimationFrame(drawFrame);
				socket.emit("get data");
				field.ctx.clearRect(0,0,field.cw,field.ch);
				field.draw();
				socket.food.draw();
				if(socket.p1.fadeout){
					opacity -= 0.01;
					field.ctx.globalAlpha = opacity;
					if(opacity <=0){
						window.cancelAnimationFrame(drawFrames);
						field.deathScreen(function(){
							var es = document.getElementById("endscreen");
							es.style.display = "block";
							es.innerHTML = socket.winner + " wins!<br><a id='pa' href='/'>Play Again</a>";
						});
						return;
					}
				}
				socket.p1.draw();
				field.ctx.globalAlpha = 1;
				if(socket.p2.fadeout){
					opacity -= 0.01;
					field.ctx.globalAlpha = opacity;
					if(opacity <=0){
						window.cancelAnimationFrame(drawFrames);
						field.deathScreen(function(){
							var es = document.getElementById("endscreen");
							es.style.display = "block";
							es.innerHTML = socket.winner + " wins!<br><a id='pa' href='/'>Play Again</a>";
						});
						return;
					}
				}
				socket.p2.draw();
				field.ctx.globalAlpha = 1;
			})();
		});

	});

	// runs when a match is found
	// by this time we have painted the initial start fram
	// when it says start, the game starts
	function countDown(callback){
		window.countdown = document.getElementById("countdown");
		countdown.style.display = "block";
		var count = 3;
		(function tick(){
			countdown.innerHTML = count;
			count--;
			if(count>=0){
				setTimeout(tick, 1000);
			} else {
				countdown.innerHTML = "START";
				countdown.className = "fade";
				callback();
			}
		})();
	};

	// field is all information pertaining to the canvas
	window.Field = (function(){

		// Constructor
		function Field(){
			this.screen = Field.screen = document.getElementById("canvas");        // Canvas Reference
			this.ctx = Field.ctx = Field.screen.getContext("2d");                // Contect API
			Field.screen.style.background = "#333";                  // Canvas bg color
			this.cw = Field.cw = parseInt(Field.screen.style.width = "1000px"); // Canvas Height
			this.ch = Field.ch = parseInt(Field.screen.style.height = "700px"); // Canvas Width
		};

		// Method to draw Field board grid
		Field.prototype.draw = function(){
			Field.ctx.strokeStyle = "#222";
			for(var x = 20; x<Field.cw; x += 20){
				Field.ctx.beginPath();
				Field.ctx.moveTo(x,0);
				Field.ctx.lineTo(x,Field.ch);
				Field.ctx.stroke();
			}
			for(var x = 20; x<Field.ch; x += 20){
				Field.ctx.beginPath();
				Field.ctx.moveTo(0,x);
				Field.ctx.lineTo(Field.cw,x);
				Field.ctx.stroke();
				Field.ctx.closePath();
			}
		}

		Field.prototype.deathScreen = function(cb){
			Field.ctx.clearRect(0,0,Field.cw,Field.ch);
			Field.ctx.fillStyle = "#1FCA23";
			Field.ctx.fillRect(0,0,Field.cw,Field.ch);
			cb();
		}

		// Return Map
		return Field;

	})();

	window.Snake = (function(){

		// Constructor
		function Snake(){
			this.color = [];
			this.body = [];
			this.fadeout = false;
			this.name = "";
		}

		// body is an array of objects with an xpos value and a ypos value
		// colors in an array of colors that defines the snake body; 0 = head, 1,2=body patern
		// red snake = ["#EB080F","#F93A3f","#FB7478"];
		// green snake = ["#00ff00", "#007f00", "#66FF66"];
		Snake.prototype.draw = function(){
			var that = this;
			for(var i = 0; i<this.body.length; i++){
				(function colorSnake(colorNum,callback){
					if(colorNum === 0){
						Field.ctx.fillStyle = that.color[0];
						callback();
					} else if (colorNum === 1){
						Field.ctx.fillStyle = that.color[1];
						callback();
					} else if (colorNum === 2){
						Field.ctx.fillStyle = that.color[2];
						callback();
					} else {
						while(colorNum>2){
							colorNum-=2;
						}
						colorSnake(colorNum,callback);
					}
				})(i,function(){
					Field.ctx.fillRect(
						that.body[i].xpos+1,
						that.body[i].ypos+1,
						18,
						18
					);
				});
			}
		};

		// snake controls send user input to server to control movement
		Snake.prototype.emitControls = function(socket){
			window.addEventListener("keypress", function(e){
				var k = e.keyCode;
				// check key code for lowercase and capital
				// if our controls match, send direction to server
				// server validates the move
				if(k === 119 || k === 87){
					var direction = 1;
				} else if (k === 100 || k === 68){
					var direction = 2;
				} else if (k ===115 || k === 83){
					var direction = 3;
				} else if (k===97 ||k===65){
					var direction = 4;
				}
				if(direction){
					socket.emit("direction change", {
						dir: direction
					});
				}
			});
		}

		// Return Snake
		return Snake;
	})();

	window.Food = (function(){

		function Food(){
			this.set = [];
			this.colors = [];
		}

		Food.prototype.draw = function(){
			for(var i = 0; i<this.set.length; i++){
				Field.ctx.fillStyle = this.colors[this.set[i].color];
				Field.ctx.fillRect(this.set[i].x+1,this.set[i].y+1,18,18);
			}
		}

		// return food
		return Food;

	})();
	
})(this,document);