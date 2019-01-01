// Strip setup.
SPI1.setup({baud:3200000, mosi:A7, sck:A5, miso:A6});
var LENGTH = 20;
var ledStrip = require('@amperka/led-strip').connect(SPI1, LENGTH, 'RGB');

// IR setup.
var receiver = require('@amperka/ir-receiver').connect(P8);

// Monkey patch.
ledStrip.putUintColor = function(index, R, G, B) {
  var i = index * 3;

  this._result[i] = R;
  this._result[i+1] = G;
  this._result[i+2] = B;

  return this;
};

// Mechanics.
var PERIOD_STORM = 25;
var STRIKE_PROBABILITIES_PER_SECOND = new Float32Array([0.005, 0.01, 0.025, 0.05, 0.075, 0.1]);
var STRIKE_LENGTH = 1000;
var STRIKE_INTENSITY = STRIKE_LENGTH / PERIOD;
var STRIKE_PROBABILITIES = STRIKE_PROBABILITIES_PER_SECOND.map(p => 1.0 - Math.pow(1.0 - p, 1.0/STRIKE_INTENSITY));
var PROBABILITY_ID = 3;
var STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];

var PERIOD_MOOD = 40;
var MOOD_STEP = 0.1;
var BRIGHTNESS = 1.0;
var BRIGHTNESS_STEP = 0.05;

// Colors.
var BACKGROUND = [0.1, 0.1, 0.2];
var BLACK = [0.0, 0.0, 0.0];
var WHITE = [1.0, 1.0, 1.0];
var SUNNY = [1.0, 0.8, 0.1];
var STEP = WHITE.map((val, id) => (val - BACKGROUND[id]) * 1.0 / STRIKE_INTENSITY);
var STORM_COLORS_R = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[0]));
var STORM_COLORS_G = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[1]));
var STORM_COLORS_B = Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[2]));

// Programs.
var OFF = 0;
var LAMP = 1;
var STORM = 2;
var MOOD = 3;

// States.
var colors = Array(LENGTH).fill(SUNNY);
var colors_mood = Array(LENGTH).fill(SUNNY);
var weather = Uint16Array(LENGTH).fill(0);
var program = OFF;

function rand(max) {
  return Math.floor(Math.random() * max);
}

function apply(col_arr)
{
  (col_arr ? col_arr : colors).forEach(function(color, id) {
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

function do_mood() {
  var led = rand(length);
  var col = rand(3);
  if (rand(1)) {
    colors_mood[led][col] = Math.max(1.0, colors_mood[led][col] + MOOD_STEP);
  } else {
    colors_mood[led][col] = Math.min(0.0, colors_mood[led][col] - MOOD_STEP);
  }

  ledStrip.putColor(led, colors_mood[led]);
  ledStrip.apply();
}

var timer = 0;

receiver.on('receive', function(code, repeat) {
  old_prog = program;
  if (!repeat && code == receiver.keys.POWER) {
    program = program ? OFF : LAMP;
  } else if (!repeat && code == receiver.keys.X) {
    program = LAMP;
  } else if (!repeat && code == receiver.keys.Y) {
    program = STORM;
  } else if (!repeat && code == receiver.keys.Z) {
    program = MOOD;
  } else if (code == receiver.keys.PLUS) {
    if (program == STORM && !repeat) {
      // Change intensity.
      PROBABILITY_ID = Math.max(PROBABILITY_ID + 1, STRIKE_PROBABILITIES.length - 1);
      STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    } else if (program == LAMP || program == MOOD) {
      // Change brightness.
      BRIGHTNESS = Math.max(1.0, BRIGHTNESS + BRIGHTNESS_STEP);
      ledStrip.brightness(BRIGHTNESS);
      if (program == LAMP) {
        ledStrip.apply();
      }
    }
  } else if (code == receiver.keys.MINUS) {
    if (program == STORM && !repeat) {
      // Change intensity.
      PROBABILITY_ID = Math.min(PROBABILITY_ID - 1, 0);
      STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    } else if (program == LAMP || program == MOOD) {
      // Change brightness.
      BRIGHTNESS = Math.min(0.0, BRIGHTNESS - BRIGHTNESS_STEP);
      ledStrip.brightness(BRIGHTNESS);
      if (program == LAMP) {
        ledStrip.apply();
      }
    }
  }
  if (old_prog != program) {
    console.log('Mode is', program);
    start_program(old_prog, program);
  }
});

function start_program(old_prog, p)
{
  console.log('Activationg program', program);
  if (old_prog == storm || old_prog == MOOD) {
    clearInterval(timer);
  }
  if (program == OFF) {
    apply(Array(length).fill(BLACK));
  } else if (program == LAMP) {
    apply();
  } else if (program == STORM) {
    apply(Array(length).fill(BACKGROUND));
    PROBABILITY_ID = 3;
    STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    timer = setInterval(do_storm, PERIOD_STORM);
  } else if (program == MOOD) {
    apply(colors_mood);
    timer = setInterval(do_mood, PERIOD_MOOD);
  }
}

// Deep sleep causes weird freezes with IR connected.
//setDeepSleep(true);
//setSleepIndicator(LED1);
setBusyIndicator(LED2);

