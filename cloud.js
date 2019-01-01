// Strip setup.
SPI1.setup({baud:3200000, mosi:A7, sck:A5, miso:A6});
var LENGTH = 20;
var ledStrip = require('@amperka/led-strip').connect(SPI1, LENGTH, 'RGB');

// Monkey patch.
ledStrip.putUintColor = function(index, R, G, B) {
  var i = index * 3;

  this._result[i] = R;
  this._result[i+1] = G;
  this._result[i+2] = B;

  return this;
};

// Mechanics.
var PERIOD = 25;
var STRIKE_PROBABILITY_PER_SECOND = 0.05;
var STRIKE_LENGTH = 1000;
var STRIKE_INTENSITY = STRIKE_LENGTH / PERIOD;
var STRIKE_PROBABILITY = 1.0 - Math.pow(1.0 - STRIKE_PROBABILITY_PER_SECOND, 1.0/STRIKE_INTENSITY);

// Colors.
var BACKGROUND = [0.1, 0.1, 0.2];
var BLACK = [0.0, 0.0, 0.0];
var WHITE = [1.0, 1.0, 1.0];
var STEP = WHITE.map((val, id) => (val - BACKGROUND[id]) * 1.0 / STRIKE_INTENSITY);
var STORM_COLORS_R = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[0]));
var STORM_COLORS_G = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[1]));
var STORM_COLORS_B = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[2]));
console.log('Color map R', STORM_COLORS_R);
console.log('Color map G', STORM_COLORS_G);
console.log('Color map B', STORM_COLORS_B);

// Programs.
var LAMP = 0;
var STORM = 1;

// States.
var colors = Array(LENGTH).fill(BACKGROUND);
var weather = Uint16Array(LENGTH).fill(0);
var program = STORM;

// Debug.
console.log('Timer period is', PERIOD, 'ms');
console.log('Strike length is', STRIKE_LENGTH, 'ms');
console.log('Strike intensity is', STRIKE_INTENSITY);
console.log('Strike probability per second is', STRIKE_PROBABILITY_PER_SECOND, ' per interval ', STRIKE_PROBABILITY);

function apply()
{
  colors.forEach(function(color, id) {
    ledStrip.putColor(id, color);
  });
  ledStrip.apply();
}

apply();

function do_storm() {
  weather.forEach(function(w, id) {
    if (w == 0) {
      if (Math.random() <= STRIKE_PROBABILITY) {
        weather[id] = STRIKE_INTENSITY;
        ledStrip.putUintColor(id, 255, 255, 255);
      }
    } else {
      w = w - 1;
      ledStrip.putUintColor(id, STORM_COLORS_R[w], STORM_COLORS_G[w], STORM_COLORS_B[w]);
      weather[id] = w;
    }
  });

  ledStrip.apply();
}

var storm_timer = setInterval(do_storm, PERIOD);

