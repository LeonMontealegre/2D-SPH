import {SPH, bounds, ms} from "./SPH";
import {V} from "Vector";

// Load canvas to draw
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let sph = undefined;

let particleDrawRadius = 0.008;

function init() {
    sph = new SPH();
    sph.init();

    draw();
}

window.addEventListener('keyup', onKeyUp, false);
window.addEventListener('resize', resize, false);


resize();

function draw() {
    const particles = sph.particles;
    const walls = sph.walls;

    const zoom = 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / (bounds.r - bounds.l) / zoom, canvas.height / (bounds.t - bounds.b) / zoom);
    ctx.translate(bounds.l + bounds.r * (zoom / 2.0 - 0.5), bounds.b + bounds.t*(zoom / 2.0 + 0.5));

    for (var i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.fillStyle = p.restDensity >= 998 ? '#017eec' : '#ef2c22';
        ctx.beginPath();
        ctx.arc(p.pos.x, -p.pos.y, particleDrawRadius, 0, 2*Math.PI);
        ctx.fill();
        ctx.closePath();
    }

    ctx.lineWidth = 0.01;
    ctx.strokeStyle = '#999';
    for (let wall of walls) {
        ctx.beginPath();
        const dir = V(1-Math.abs(wall.normal.x), 1-Math.abs(wall.normal.y));
        const x1 =  wall.pos.x - dir.x*1000 - wall.normal.x*0.01;
        const x2 =  wall.pos.x + dir.x*1000 - wall.normal.x*0.01;
        const y1 = -wall.pos.y - dir.y*1000 + wall.normal.y*0.01;
        const y2 = -wall.pos.y + dir.y*1000 + wall.normal.y*0.01;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.closePath();
    }

    ctx.restore();
}


var interval = undefined;
function pause() {
    clearInterval(interval);
    interval = undefined;
}
function play() {
    interval = setInterval(function() {
        sph.step();
        draw();
    }, ms);
}

function onKeyUp(e) {
    if (e.keyCode == 65) {
        if (interval)
            pause();
        else
            play();
    }

    // Reset
    if (e.keyCode == 82) {
        init();
        pause();
    }

    if (e.keyCode == 32) {
        sph.step();
        draw();
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (sph)
        draw();
}

document.body.onload = () => {
    init();
    play();
    console.log("play");
}