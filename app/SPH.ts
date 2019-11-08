import {V, Vector} from "Vector";

import {Wpoly6,
        Wpoly6Gradient,
        WspikyGradient,
        WviscosityLaplacian,
        Wpoly6Laplacian,
        h2} from "./utils/Kernels";

import {REST_DENSITY,
        Particle} from "./Particle";

import {WALL_K,
        WALL_DAMPING,
        Wall} from "./Wall";

const g = V(0, -9.81);

export const ms = 16;
const dt = 1.0 / 100.0;

const SOLVER_ITERATIONS = 5;
const RELAXATION = 5000;
const SURFACE_TENSION = 0.0728;
const SURFACE_THRESHOLD = 7.065;

export let bounds = {l: 0, r: 0.8, b: 0, t: 0.5};

let nx = 20;
let ny = 20;

let scene = 0;

export class SPH {
    public time: number;
    public particles: Particle[];
    public walls: Wall[];

    constructor() {
        this.time = 0;
        this.particles = [];
        this.walls = [new Wall(V(1, 0), V(bounds.l, 0)), new Wall(V(-1,  0), V(bounds.r, 0)),
                      new Wall(V(0, 1), V(0, bounds.b)), new Wall(V( 0, -1), V(0, bounds.t))];
    }
    init() {
        let dx = (bounds.r - bounds.l) / nx;
        let dy = (bounds.t - bounds.b) / ny;

        if (scene == 0 || scene == 1 || scene == 4 || scene == 5 || scene == 6 || scene == 7) {
            for (let x = bounds.l; x < bounds.r; x += dx) {
                for (let y = bounds.b; y < bounds.t; y += dy) {
                    this.particles.push(new Particle(V(x+Math.random()/60+(bounds.r - bounds.l)/100,
                                                       y+(bounds.r - bounds.l)/100), 0.02));
                }
            }
        } else if (scene == 2) {
            for (let x = bounds.l; x < bounds.r; x += dx) {
                for (let y = bounds.b; y < bounds.t; y += dy) {
                    const density = (Math.random() < 0.5 ? 450.0 : REST_DENSITY);
                    this.particles.push(new Particle(V(x+Math.random()/60+(bounds.r - bounds.l)/100,
                                                       y+(bounds.r - bounds.l)/100), 0.02, density));
                }
            }
        } else if (scene == 3) {
            // Generate ground
            dy = (bounds.t/5 - bounds.b) / ny;
            for (let x = bounds.l; x < bounds.r; x += dx) {
                for (let y = bounds.b; y < bounds.t/5; y += dy) {
                    this.particles.push(new Particle(V(x+Math.random()/60+(bounds.r - bounds.l)/100,
                                                       y+(bounds.r - bounds.l)/100), 0.02));
                }
            }
            // Generate circle
            let yy = bounds.t * 4/5;
            let xx = (bounds.r - bounds.l) / 2;
            let r = bounds.t * 0.8/5;
            dx = (2*r) / 15;
            dy = (2*r) / 15;
            for (let x = xx - r; x <= xx + r; x += dx) {
                for (let y = yy - r; y <= yy + r; y += dy) {
                    if ((x-xx)*(x-xx) + (y-yy)*(y-yy) <= r*r)
                        this.particles.push(new Particle(V(x+Math.random()/60+(bounds.r - bounds.l)/100,
                                                           y+(bounds.r - bounds.l)/100), 0.02));
                }
            }
        }
        console.log("Particles: " + this.particles.length);
    }
    step() {
        let freq1 = 5;
        let freq2 = 5;
        if (scene == 5)
            freq2 = 3;
        if (scene == 0 || scene == 4 || scene == 5)
            this.walls[0].pos.x = (1 - Math.cos(this.time*freq1))/5.0 + bounds.l;
        if (scene == 4 || scene == 5)
            this.walls[1].pos.x = -(1 - Math.cos(this.time*freq2))/5.0 + bounds.r;

        if (scene == 7)
            this.walls[0].pos.x = (1 - Math.cos(this.time*freq1))/10.0 + bounds.l;

        if (scene == 6) {
            let p = new Particle(V(bounds.l + 0.05, bounds.t));
            p.vel = V(2, 0);
            this.particles.push(p);
        }

        this.collectNeighbors();

        // Calculate density and pressure
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const neighbors = particle.neighbors;

            particle.density = particle.mass * Wpoly6(0);

            // Find neighbors
            for (let j = 0; j < neighbors.length; j++) {
                const jj = neighbors[j];
                if (i == jj)
                    continue;

                const neighbor = this.particles[jj];

                const r = particle.pos.sub(neighbor.pos);
                const r2 = r.len2();

                const density = neighbor.mass * Wpoly6(r2);
                particle.density += density;
            }

            particle.pressure = particle.gasConstant * (particle.density - particle.restDensity);
        }

        // Calculate forces
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const neighbors = particle.neighbors;

            let f_pressure  = V(0, 0);
            let f_viscosity = V(0, 0);
            let f_surface   = V(0, 0);

            let f_gravity = g.scale(particle.density);

            let colorFieldNormal = V(0, 0);
            let colorFieldLaplacian = 0;

            let neighborCount = 0;

            for (let j = 0; j < neighbors.length; j++) {
                const jj = neighbors[j];
                const neighbor = this.particles[jj];

                const r = particle.pos.sub(neighbor.pos);
                const r2 = r.len2();

                neighborCount++;
                const poly6Gradient = Wpoly6Gradient(r, r2);
                const spikyGradient = WspikyGradient(r, r2);

                if (i != jj) {
                    f_pressure = f_pressure.add(spikyGradient.scale(-neighbor.mass * (particle.pressure + neighbor.pressure) / (2 * neighbor.density)));

                    f_viscosity = f_viscosity.add((neighbor.vel.sub(particle.vel)).scale(
                                    (particle.viscosity + neighbor.viscosity) / 2 * neighbor.mass *
                                    WviscosityLaplacian(r2) / neighbor.density));
                }

                colorFieldNormal = colorFieldNormal.add(poly6Gradient.scale(neighbor.mass / neighbor.density));

                colorFieldLaplacian += neighbor.mass * Wpoly6Laplacian(r2) / neighbor.density;
            }

            const colorFieldNormalMagnitude = colorFieldNormal.len();
            if (colorFieldNormalMagnitude > SURFACE_THRESHOLD) {
                f_surface = colorFieldNormal.scale(-SURFACE_TENSION * colorFieldLaplacian / colorFieldNormalMagnitude);
            }

            const force = f_pressure.add(f_viscosity).add(f_surface).add(f_gravity);

            particle.accelerate(force.scale(1.0 / particle.density));

            this.collisionForce(particle);
        }

        this.time += dt;


        // Apply positional-based fluid constraints
        let newPositions = new Array<Vector>(this.particles.length).fill(V(0,0));
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].vel = this.particles[i].vel.add( this.particles[i].acc.scale(dt) ); // apply exterior forces
            newPositions[i] = this.particles[i].pos.add( this.particles[i].vel.scale(dt) ); // predict position
        }

        this.collectNeighbors();

        let iter = 0;
        while (iter < SOLVER_ITERATIONS) {
            let lambdas = new Array(this.particles.length).fill(0);
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                const neighbors = particle.neighbors;

                // calculate density
                particle.density = particle.mass * Wpoly6(0);
                let gradSqrNorm = 0;
                let dWpi = V(0,0);

                for (let j = 0; j < neighbors.length; j++) {
                    let jj = neighbors[j];
                    if (i == jj)
                        continue;
                    const neighbor = this.particles[jj];

                    const r = newPositions[i].sub(newPositions[jj]);
                    const r2 = r.len2();

                    gradSqrNorm += Wpoly6Laplacian(r2);
                    dWpi = dWpi.add(Wpoly6Gradient(r, r2));

                    particle.density += neighbor.mass*Wpoly6(r2);
                }

                gradSqrNorm = gradSqrNorm / (particle.restDensity*particle.restDensity);
                gradSqrNorm += dWpi.len2();

                let Ci = particle.density / particle.restDensity - 1;
                lambdas[i] = -Ci / (gradSqrNorm + RELAXATION)
            }


            let deltaPositions = new Array(this.particles.length).fill(V(0,0));
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                const neighbors = particle.neighbors;

                let pos = V(0,0);
                for (let j = 0; j < neighbors.length; j++) {
                    let jj = neighbors[j];
                    if (i == jj)
                        continue;

                    const neighbor = this.particles[jj];

                    const r = newPositions[i].sub(newPositions[jj]);
                    const r2 = r.len2();

                    pos = pos.add(Wpoly6Gradient(r, r2).scale(lambdas[i] + lambdas[jj]));
                }
                deltaPositions[i] = pos.scale(1.0 / particle.restDensity);
            }

            for (let i = 0; i < this.particles.length; i++) {
                newPositions[i] = newPositions[i].add(deltaPositions[i]);
            }

            iter++;
        }

        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];

            this.particles[i].vel = (newPositions[i].sub(particle.pos)).scale(1.0 / dt);
            this.particles[i].pos = newPositions[i];

            if (this.particles[i].pos.x > bounds.r+1 || this.particles[i].pos.x < bounds.l-1 || this.particles[i].pos.x > bounds.t+1 || this.particles[i].pos.y < bounds.b-1) {
                this.particles.splice(i, 1);
                i--;
                console.log("OUT OF BOUNDS!");
            }
        }
    }
    collisionForce(particle) {
        for (let i = 0; i < this.walls.length; i++) {
            const wall = this.walls[i];

            const d = (wall.pos.sub(particle.pos)).dot(wall.normal);// + 0.01;

            if (d > 0.0) {
                particle.acc = particle.acc.add(wall.normal.scale(WALL_K * d));
                particle.acc = particle.acc.add(wall.normal.scale(WALL_DAMPING * particle.vel.dot(wall.normal)));
            }
        }
    }
    collectNeighbors(newPositions = undefined) {
        // Clear previous neighbors
        for (let i = 0; i < this.particles.length; i++)
            this.particles[i].neighbors = [];

        // Find each neighbor for each particle
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i; j < this.particles.length; j++) {
                const p1 = (newPositions ? newPositions[i] : this.particles[i].pos);
                const p2 = (newPositions ? newPositions[j] : this.particles[j].pos);

                // Check if within radius^2
                if (p1.sub(p2).len2() < h2) {
                    this.particles[i].neighbors.push(j);
                    this.particles[j].neighbors.push(i);
                }
            }
        }
    }
}
