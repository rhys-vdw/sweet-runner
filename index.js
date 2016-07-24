"use strict"

const five = require("johnny-five");
const _ = require('lodash');
const leftPad = require('left-pad');

const loopDuration = 150;
const rowCount = 2;
const columnCount = 16;

const board = new five.Board();

board.on("ready", function() {

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


  const manSprite = 'runninga';

  // Add block frames into an array. Each element is the top and bottom sprite
  // (`null` when none should be shown).
  const blockFrames = [
    ['ascchart2', null],
    ['ascchart4', null],
    ['ascchart6', null],
    ['fullprogress', null],
    ['descchart6', 'ascchart2'],
    ['descchart4', 'ascchart4'],
    ['descchart2', 'ascchart6'],
    [null, 'fullprogress'],
    [null, 'descchart6'],
    [null, 'descchart4'],
    [null, 'descchart2'],
  ];

  let frame = 0;

  let nextPosition = 0;
  let previousPosition = 0;
  const blocks = _.times(columnCount, () => null);

  function drawSprite(row, column, sprite) {
    if (sprite != null) {
      lcd.cursor(row, column);
      lcd.print(`:${sprite}:`);
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

    lcd.clear()
      .print("==SWEET RUNNER==")
      .cursor(1, 0)
      .print("  TWIST TO PLAY ");

    let from = getInput();
    board.loop(500, endLoop => {
      const to = getInput();
      const change = Math.abs(from - to);
      if (change > 0.2) {
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

    lcd.clear();

    drawSprite(1, nextPosition, manSprite);

    _.each(blocks, (block, col) => {
      if (block != null) {
        block.frameCount += 1;

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

      lcd.clear()
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
