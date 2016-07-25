"use strict"

const five = require("johnny-five");
const _ = require('lodash');
const leftPad = require('left-pad');

const loopDuration = 150;
const rowCount = 2;
const columnCount = 16;

const board = new five.Board();

const staccato = (item) => {
  const note = item[0];
  const duration = item[1];
  return [[note, duration - 0.1], [null, 0.1]];
};

const themeTune = {
  song: _.flatMap([
    ['E4', 3/4],
    ['B5', 1/4],
    ['E4', 1/4],
    ['B5', 1/4],
    ['E4', 1/4],
    ['B4', 1/4],
    ['E4', 1/4],
    ['B4', 1/4],
    [null, 1/4]
  ], staccato),
  tempo: 80
};

const awakeTune = {
  song: _.flatMap([
    ['E4', 1/4],
    ['G4', 1/4],
    ['C5', 1/4],
    [null, 1/4]
  ], staccato),
  tempo: 80
};

const deathTune = {
  song: _.flatMap([
    [null, 2/4],
    ['C5', 1/4],
    ['G4', 1/4],
    ['E4', 1/4],
    [null, 1/4]
  ], staccato),
  tempo: 80
};

board.on("ready", function() {

  // Create a standard `piezo` instance on pin 3
  var piezo = new five.Piezo(3);

  // Clear buffer? Sometimes the piezo makes unwanted sounds.
  piezo.stop();

  board.on('exit', () => {

    // Prevent awful high pitched whine.
    piezo.stop();
  });

  // Clone tune objects to avoid bug:
  // https://github.com/rwaldron/johnny-five/issues/1186
  //
  function playTune(tune) {
    piezo.play(_.cloneDeep(tune));
  }

  // Create a new `potentiometer` hardware instance.
  const potentiometer = new five.Sensor({ pin: "A2", loopDuration });

  const lcd = new five.LCD({
    pins: [7, 8, 9, 10, 11, 12],
    backlight: 6,
    rows: rowCount,
    cols: columnCount,
  });

  // Use a maximum of 8 different special characters. This is limited by buffer
  // size of `lcd` unit.
  //
  // See: http://johnny-five.io/api/lcd/#usecharcharcodename
  //
  lcd.useChar('runninga');
  lcd.useChar('ascchart2');
  lcd.useChar('ascchart4');
  lcd.useChar('ascchart6');
  lcd.useChar('fullprogress');
  lcd.useChar('descchart2');
  lcd.useChar('descchart4');
  lcd.useChar('descchart6');


  const manSprite = ':runninga:';

  // Add block frames into an array. Each element is the top and bottom sprite
  // (`null` when none should be shown).
  const blockFrames = [
    [':ascchart2:', ' '],
    [':ascchart4:', ' '],
    [':ascchart6:', ' '],
    [':fullprogress:', ' '],
    [':descchart6:', ':ascchart2:'],
    [':descchart4:', ':ascchart4:'],
    [':descchart2:', ':ascchart6:'],
    [' ', ':fullprogress:'],
    [' ', ':descchart6:'],
    [' ', ':descchart4:'],
    [' ', ':descchart2:'],
  ];

  let frame = 0;

  let nextPosition = 0;
  let previousPosition = 0;
  const blocks = _.times(columnCount, () => null);

  function drawSprite(row, column, sprite) {
    if (sprite != null) {
      lcd.cursor(row, column);
      lcd.print(sprite);
    }
  }

  function getInput() {
    return 1 - (potentiometer.value / 1023);
  }
  // "data" get the current reading from the potentiometer
  potentiometer.on("data", event => {
    nextPosition = Math.floor(getInput() * 15);
  });

  function createBlock() {
    return { frameCount: 0 }
  }

  function spawnBlock() {
    const validIndices = blocks.reduce((result, block, index) => {
      if (block == null) {
        result.push(index);
      }
      return result;
    }, []);

    if (validIndices.length === 0) {
      return;
    }

    blocks[_.sample(validIndices)] = createBlock();
  }

  let levelPeriod = 40;
  let blockPeriod = 5;
  let blocksPerSpawn = 1;
  let frameNumber = 0;

  let isRunning = false;

  function resetState() {
    for (let i = 0; i < blocks.length; i++) {
      blocks[i] = null;
    }
    blockPeriod = 5;
    blocksPerSpawn = 1;
    frameNumber = 0;
  }

  function startGame(callback) {

    playTune(themeTune);

    lcd.clear()
      .print("==SWEET RUNNER==")
      .cursor(1, 0)
      .print("  TWIST TO PLAY ");

    let from = getInput();
    board.loop(500, endLoop => {
      const to = getInput();
      const change = Math.abs(from - to);
      if (change > 0.2) {
        playTune(awakeTune);
        lcd.clear();
        isRunning = true;
        endLoop();
      }
    });
  }

  board.loop(loopDuration, () => {

    if (!isRunning) return;

    let isGameOver = false;

    frameNumber++;

    if ((frameNumber % blockPeriod) === 0) {
      for (let i = 0; i < blocksPerSpawn; i++) {
        spawnBlock();
      }
    };

    if ((frameNumber % levelPeriod) === 0) {
      if (blockPeriod === 1) {
        blocksPerSpawn++;
      } else {
        blockPeriod--;
      }
    }

    _.each(blocks, (block, col) => {
      if (block != null) {
    drawSprite(1, nextPosition, manSprite);

        block.frameCount++;

        if (block.frameCount > 4 && block.frameCount < 11 && nextPosition === col) {
          isGameOver = true;
        }

        // Destroy block.
        if (block.frameCount >= blockFrames.length) {
          blocks[col] = null;

        } else {
          const frame = blockFrames[block.frameCount];
          drawSprite(0, col, frame[0]);
          drawSprite(1, col, frame[1]);
        }
      }
    });

    if (isGameOver) {
      isRunning = false;

      playTune(deathTune);

      lcd
        .cursor(0, 0).print('    YOU DIED   ')
        .cursor(1, 0).print(`SCORE: ${leftPad(frameNumber, 9)}`);

      resetState();

      board.wait(1500, () => {
        startGame();
      });
    }
  });

  board.wait(3000, () => startGame());
});
