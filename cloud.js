// Strip setup.
SPI1.setup({baud:3200000, mosi:A7, sck:A5, miso:A6});
var LENGTH = 20;
var ledStrip = require('@amperka/led-strip').connect(SPI1, LENGTH, 'RGB');
ledStrip.clear();

// IR setup.
var receiver = require('@amperka/ir-receiver').connect(B1);

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
var STRIKE_INTENSITY = STRIKE_LENGTH / PERIOD_STORM;
var STRIKE_PROBABILITIES = STRIKE_PROBABILITIES_PER_SECOND.map(p => 1.0 - Math.pow(1.0 - p, 1.0/STRIKE_INTENSITY));
var PROBABILITY_ID = 3;
var STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
var TIME_NIGHTLIGHT = 60000;

var PERIOD_MOOD = 40;
var MOOD_STEP = 0.1;
var BRIGHTNESS = 1.0;
var BRIGHTNESS_STEP = 0.05;

// Colors.
var BACKGROUND = [0.1, 0.1, 0.2];
var BLACK = [0.0, 0.0, 0.0];
var WHITE = [1.0, 1.0, 1.0];
var RED = [1.0, 0, 0];
var GREEN = [0, 1.0, 0];
var BLUE = [0, 0, 1.0];
var PURPLE = [1.0, 0, 1.0];
var CYAN = [0, 1.0, 1.0];
var YELLOW = [1.0, 1.0, 0];
var SUNNY = [1.0, 0.8, 0.1];
var STEP = WHITE.map((val, id) => (val - BACKGROUND[id]) * 1.0 / STRIKE_INTENSITY);
var STORM_COLORS_R = new Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[0]));
var STORM_COLORS_G = new Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[1]));
var STORM_COLORS_B = new Uint8ClampedArray(STRIKE_INTENSITY).fill(0).map((c, i) => 255*(STEP[0]*i + BACKGROUND[2]));
var NIGHTLIGHT_BRIGHTNESS = 0.3;

// Programs.
var OFF = 0;
var LAMP = 1;
var STORM = 2;
var MOOD = 3;
var NIGHTLIGHT = 4;

// States.
var lamp_colors = [SUNNY, WHITE, RED, GREEN, BLUE, PURPLE, CYAN, YELLOW];
var lamp_id = 0;
// Need colors* to store copies of color instead of reference to the same object.
var colors_mood = Array(LENGTH).fill().map(x => SUNNY.map(x=>x));
var weather = new Uint16Array(LENGTH).fill(0);
var program = OFF;

function rand(max) {
  return Math.floor(Math.random() * max);
}

function apply(col_arr)
{
  col_arr.forEach(function(color, id) {
    ledStrip.putColor(id, color);
  });
  ledStrip.apply();
}

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
  var led = rand(LENGTH);
  var col = rand(3);
  if (Math.random() > 0.5) {
    colors_mood[led][col] = Math.min(1.0, colors_mood[led][col] + MOOD_STEP);
  } else {
    colors_mood[led][col] = Math.max(0.0, colors_mood[led][col] - MOOD_STEP);
  }

  ledStrip.putColor(led, colors_mood[led]);
  ledStrip.apply();
}

function nightlight_off() {
  if (program == NIGHTLIGHT) {
    start_program(OFF, false);
  }
}

var timer = 0;

receiver.on('receive', function(code, repeat) {
  new_prog = program;
  restart = false;
  if (!repeat && code == receiver.keys.POWER) {
    new_prog = program ? OFF : LAMP;
  } else if (!repeat && code == receiver.keys.CROSS) {
    new_prog = NIGHTLIGHT;
  } else if (program == OFF) {
    return; // Don't act on remote commands when off.
  } else if (!repeat && code == receiver.keys.X) {
    new_prog = LAMP;
  } else if (!repeat && code == receiver.keys.Y) {
    new_prog = STORM;
  } else if (!repeat && code == receiver.keys.Z) {
    new_prog = MOOD;
  } else if (code == receiver.keys.PLUS) {
    if (program == STORM && !repeat) {
      // Change intensity.
      PROBABILITY_ID = Math.min(PROBABILITY_ID + 1, STRIKE_PROBABILITIES.length - 1);
      STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    } else if (program == LAMP || program == MOOD) {
      // Change brightness.
      BRIGHTNESS = Math.min(1.0, BRIGHTNESS + BRIGHTNESS_STEP);
      ledStrip.brightness(BRIGHTNESS);
      if (program == LAMP) {
        ledStrip.apply();
      }
    }
  } else if (code == receiver.keys.MINUS) {
    if (program == STORM && !repeat) {
      // Change intensity.
      PROBABILITY_ID = Math.max(PROBABILITY_ID - 1, 0);
      STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    } else if (program == LAMP || program == MOOD) {
      // Change brightness.
      BRIGHTNESS = Math.max(0.0, BRIGHTNESS - BRIGHTNESS_STEP);
      ledStrip.brightness(BRIGHTNESS);
      if (program == LAMP) {
        ledStrip.apply();
      }
    }
  } else if (code == receiver.keys.SQUARE && program == LAMP && !repeat) {
    lamp_id = (lamp_id + 1) % lamp_colors.length;
    restart = true;
  }
  start_program(new_prog, restart);
});

function start_program(new_prog, restart)
{
  if (new_prog == program && !restart) return;
  old_prog = program;
  program = new_prog;

  if ([STORM, MOOD, NIGHTLIGHT].indexOf(old_prog) >= 0) {
    clearInterval(timer);
  }
  if (program == OFF) {
    ledStrip.clear();
  } else if (program == LAMP) {
    ledStrip.brightness(BRIGHTNESS);
    apply(Array(LENGTH).fill(lamp_colors[lamp_id]));
  } else if (program == STORM) {
    weather = new Uint16Array(LENGTH).fill(0);
    ledStrip.brightness(1);
    apply(Array(LENGTH).fill(BACKGROUND));
    PROBABILITY_ID = 3;
    STRIKE_PROBABILITY = STRIKE_PROBABILITIES[PROBABILITY_ID];
    timer = setInterval(do_storm, PERIOD_STORM);
  } else if (program == MOOD) {
    ledStrip.brightness(BRIGHTNESS);
    apply(colors_mood);
    timer = setInterval(do_mood, PERIOD_MOOD);
  } else if (program == NIGHTLIGHT) {
    ledStrip.brightness(NIGHTLIGHT_BRIGHTNESS);
    apply(Array(LENGTH).fill(WHITE));
    timer = setTimeout(nightlight_off, TIME_NIGHTLIGHT);
  }
}

setDeepSleep(true);
setSleepIndicator(LED1);
setBusyIndicator(LED2);
