
class SPI {
	setup(x) {}
}


class Receiver {
	on(x, y) {}
}

class LedStrip {
	constructor(l) {
		this.len = l;
		this._result = Array(this.len*3).fill(0);
	}
	
	clear() {
		this._result = Array(this.len*3).fill(0);
		this.apply();
	}
	
	apply() {
		for (var i = 0; i < this.len; ++i) {
			var c1 = this._result[3*i];
			var c2 = this._result[3*i+1];
			var c3 = this._result[3*i+2];
			$(`#led${i}`).css('background-color', `rgb(${c1}, ${c2}, ${c3})`);
		}
	}
	
	brightness() {}
	
	putColor(id, color) {
		var c = color.map(x => Math.trunc(x*255));
		this._result[id*3] = c[0];
		this._result[id*3+1] = c[1];
		this._result[id*3+2] = c[2];
	}
}

class Mock {
	connect(x, len, z) {
		if (typeof len == 'undefined') {
			console.log("receiver created");
			return new Receiver();
		}
		console.log("led strip created");
		return new LedStrip(len);
	}
}

function require(x) {
	return new Mock();
}

function setDeepSleep() {}
function setSleepIndicator() {}
function setBusyIndicator() {}

var A5 = 1;
var A6 = 1;
var A7 = 1;
var B1 = 1;
var LED1 = 1;
var LED2 = 1;

var SPI1 = new SPI();

$(document).ready(function() {
	for (var i = 0; i < 20; ++i) {
		$("#lamp").append(`<div class="led" id="led${i}"></div>`)
	}
	//start_program(MOOD, false);
	start_program(STORM, false);
});