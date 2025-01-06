'use strict';

import Model from "./model.mjs";
import TrackballRotator from "./Utils/trackball-rotator.mjs";

let gl;                         // The WebGL context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.

// Параметри конуса
let a = 2;  // Радіус сфери
let p = 1;  // Константа для параметра omega
let uSegments = 300;  // Кількість сегментів по U
let vSegments = 300;  // Кількість сегментів по V

// Конвертація градусів в радіани
function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function updateSliderValue(id) {
    const value = document.getElementById(id).value;
    document.getElementById(`${id}Value`).textContent = value;
}

// Конструктор для шейдерної програми
function ShaderProgram(program) {
    this.prog = program;
    this.iAttribVertex = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iColor = -1;
    this.iLightPos = -1;
    this.iLightColor = -1;
    this.iAmbientColor = -1;
    this.iAttribFlatNormal = -1;  // Атрибут для нормалей

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

// Передача параметрів освітлення в шейдери
let angle = 0.0;  // Кут обертання джерела світла
function setLighting() {
    // Параметри освітлення
    let lightRadius = 15.0;  // Радіус орбіти джерела світла
    let lightPos = [
        lightRadius * Math.cos(angle),  // X-координата
        5.0,  // Y-координата (постійна)
        lightRadius * Math.sin(angle)   // Z-координата
    ];
    let lightColor = [1.0, 1.0, 1.0]; // Біле світло

    // Відправляємо ці параметри в шейдери
    gl.uniform3fv(shProgram.iLightLocation, lightPos);
    gl.uniform3fv(shProgram.iLightColor, lightColor);
}

// Функція для анімації джерела світла
function animate() {
    angle += 0.01;  // Оновлення кута для обертання (можна змінити швидкість обертання)
    if (angle > 2 * Math.PI) {
        angle -= 2 * Math.PI;  // Обмежуємо кут, щоб він не ставав занадто великим
    }

    // Перемалювання поверхні
    draw();

    requestAnimationFrame(animate);  // Анімація кадр за кадром
}

// Ініціалізація WebGL
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    shProgram = new ShaderProgram(prog);
    shProgram.Use();

    // Отримуємо атрибути та uniform змінні
    shProgram.iAttribVertex = gl.getAttribLocation(prog, "inVertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "inNormal");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "inTangent");
    shProgram.iAttribUV = gl.getAttribLocation(prog, "inUV");
    shProgram.iProjectionMatrix = gl.getUniformLocation(prog, "projectionMatrix");
    shProgram.iModelMatrix = gl.getUniformLocation(prog, "modelMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "normalMatrix");
    shProgram.iLightLocation = gl.getUniformLocation(prog, "lightLocation");
    shProgram.iLightColor = gl.getUniformLocation(prog, "lightColor");
    shProgram.iDiffuseTexture = gl.getUniformLocation(prog, "diffuseTexture");
    shProgram.iNormalTexture = gl.getUniformLocation(prog, "normalTexture");
    shProgram.iSpecularTexture = gl.getUniformLocation(prog, "specularTexture");

    // Оновлюємо сегменти з повзунків
    uSegments = parseInt(document.getElementById('uSegments').value, 10);
    vSegments = parseInt(document.getElementById('vSegments').value, 10);

    surface = new Model(gl, shProgram, a, p, uSegments, vSegments);  // Створюємо об'єкт моделі з параметрами
    surface.BufferData();  // Заповнюємо буфери

    gl.enable(gl.DEPTH_TEST);  // Включаємо тест глибини
}

// Функція малювання
function draw() { 
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, 1, 0.1, 100);

    /* Get the view matrix from the SimpleRotator object. */
    let modelMatrix = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    modelMatrix = m4.multiply(rotateToPointZero, modelMatrix);
    modelMatrix = m4.multiply(translateToPointZero, modelMatrix);

    let normalMatrix = m4.transpose(m4.inverse(modelMatrix, []), []);

    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, projection);
    gl.uniformMatrix4fv(shProgram.iModelMatrix, false, modelMatrix);
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    // Передаємо параметри освітлення
    setLighting();

    gl.uniform1i(shProgram.iDiffuseTexture, 0);
    gl.uniform1i(shProgram.iNormalTexture, 1);
    gl.uniform1i(shProgram.iSpecularTexture, 2);

    // Малюємо поверхню
    surface.Draw();
}

// Оновлення кількості сегментів по U та V
function updateSurface() {
    // Оновлюємо сегменти з повзунків
    uSegments = parseInt(document.getElementById('uSegments').value, 10);
    vSegments = parseInt(document.getElementById('vSegments').value, 10);

    // Оновлюємо дані поверхні
    surface.uSegments = uSegments;  // Оновлюємо сегменти в існуючій моделі
    surface.vSegments = vSegments;
    surface.BufferData();  // Оновлюємо буфери з новими сегментами

    // Перемалювання поверхні після оновлення
    draw();
}

// Створення програми
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }

    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }

    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

document.getElementById('uSegments').addEventListener('input', () => { updateSliderValue('uSegments'); });
document.getElementById('vSegments').addEventListener('input', () => { updateSliderValue('vSegments'); });
document.getElementById('UpdateButton').addEventListener('click', updateSurface);
document.addEventListener('draw', draw);

// Ініціалізація
function init() {
    let canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        document.getElementById("canvas-holder").innerHTML = "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }

    initGL();
    spaceball = new TrackballRotator(canvas, draw, 0);
    animate();  // Запускаємо анімацію
}

init();