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

import {BoundingBox} from "math/BoundingBox";

const DEFAULT_SOLVER_ITERATIONS = 5;
const DEFAULT_RELAXATION = 5000;
const DEFAULT_SURFACE_TENSION = 0.0728;
const DEFAULT_SURFACE_TENSION_THRESHOLD = 7.065;

const DEFAULT_GRAVITATIONAL_ACC = V(0, -9.81);

export const bounds = {l: 0, r: 0.8, b: 0, t: 0.5};

export const ms = 16;
const dt = 1.0 / 100.0;

const nx = 20;
const ny = 20;

export interface SPHProps {
    solverIterations: number;
    relaxation: number;
    surfaceTension: number;
    surfaceTensionThreshold: number;

    gravitationalAcc: Vector;

    dt: number;
}

export class SPHPropsBuilder {
    private props: SPHProps;

    public constructor() {
        this.props = {
            solverIterations: DEFAULT_SOLVER_ITERATIONS,
            relaxation: DEFAULT_RELAXATION,
            surfaceTension: DEFAULT_SURFACE_TENSION,
            surfaceTensionThreshold: DEFAULT_SURFACE_TENSION_THRESHOLD,
            gravitationalAcc: DEFAULT_GRAVITATIONAL_ACC,
            dt: 1/100
        }
    }

    public withSolverIterations(solverIterations: number): SPHPropsBuilder {
        this.props.solverIterations = solverIterations;
        return this;
    }

    public withRelaxation(relaxation: number): SPHPropsBuilder {
        this.props.relaxation = relaxation;
        return this;
    }

    public withSurfaceTension(surfaceTension: number): SPHPropsBuilder {
        this.props.surfaceTension = surfaceTension;
        return this;
    }

    public withSurfaceTensionThreshold(surfaceTensionThreshold: number): SPHPropsBuilder {
        this.props.surfaceTensionThreshold = surfaceTensionThreshold;
        return this;
    }

    public withGravitationalAcceleration(gravitationalAcc: Vector): SPHPropsBuilder {
        this.props.gravitationalAcc = gravitationalAcc;
        return this;
    }

    public withΔt(dt: number): SPHPropsBuilder {
        this.props.dt = dt;
        return this;
    }

    public build(): SPHProps {
        return this.props;
    }
}

export class SPH {
    public time: number;
    public particles: Particle[];
    public walls: Wall[];

    private props: SPHProps;

    public constructor(props: SPHProps) {
        this.time = 0;
        this.particles = [];
        this.walls = [new Wall(V(1, 0), V(bounds.l, 0)), new Wall(V(-1,  0), V(bounds.r, 0)),
                      new Wall(V(0, 1), V(0, bounds.b)), new Wall(V( 0, -1), V(0, bounds.t))];

        this.props = props;
    }
    public init(): void {
        let dx = (bounds.r - bounds.l) / nx;
        let dy = (bounds.t - bounds.b) / ny;

        for (let x = bounds.l; x < bounds.r; x += dx) {
            for (let y = bounds.b; y < bounds.t; y += dy) {
                this.particles.push(new Particle(V(x+Math.random()/60+(bounds.r - bounds.l)/100,
                                                   y+(bounds.r - bounds.l)/100), 0.02));
            }
        }
        console.log("Particles: " + this.particles.length);
    }
    public step(): void {
        const freq1 = 5;
        this.walls[0].pos.x = (1 - Math.cos(this.time*freq1))/5.0 + bounds.l;

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

            let fPressure  = V(0, 0);
            let fViscosity = V(0, 0);
            let fSurface   = V(0, 0);

            const fGravity = this.props.gravitationalAcc.scale(particle.density);

            let colorFieldNormal = V(0, 0);
            let colorFieldLaplacian = 0;

            for (let j = 0; j < neighbors.length; j++) {
                const jj = neighbors[j];
                const neighbor = this.particles[jj];

                const r = particle.pos.sub(neighbor.pos);
                const r2 = r.len2();

                const poly6Gradient = Wpoly6Gradient(r, r2);
                const spikyGradient = WspikyGradient(r, r2);

                if (i != jj) {
                    fPressure = fPressure.add(spikyGradient.scale(-neighbor.mass * (particle.pressure + neighbor.pressure) / (2 * neighbor.density)));

                    fViscosity = fViscosity.add((neighbor.vel.sub(particle.vel)).scale(
                        (particle.viscosity + neighbor.viscosity) / 2 * neighbor.mass *
                            WviscosityLaplacian(r2) / neighbor.density));
                }

                colorFieldNormal = colorFieldNormal.add(poly6Gradient.scale(neighbor.mass / neighbor.density));

                colorFieldLaplacian += neighbor.mass * Wpoly6Laplacian(r2) / neighbor.density;
            }

            const colorFieldNormalMagnitude = colorFieldNormal.len();
            if (colorFieldNormalMagnitude > this.props.surfaceTension) {
                fSurface = colorFieldNormal.scale(-this.props.surfaceTension * colorFieldLaplacian / colorFieldNormalMagnitude);
            }

            const force = fPressure.add(fViscosity).add(fSurface).add(fGravity);

            particle.accelerate(force.scale(1.0 / particle.density));

            this.collisionForce(particle);
        }

        this.time += dt;


        // Apply positional-based fluid constraints
        const newPositions = new Array<Vector>(this.particles.length).fill(V(0,0));
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].vel = this.particles[i].vel.add( this.particles[i].acc.scale(dt) ); // apply exterior forces
            newPositions[i] = this.particles[i].pos.add( this.particles[i].vel.scale(dt) ); // predict position
        }

        this.collectNeighbors();

        let iter = 0;
        while (iter < this.props.solverIterations) {
            const lambdas = new Array<number>(this.particles.length).fill(0);
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                const neighbors = particle.neighbors;

                // calculate density
                particle.density = particle.mass * Wpoly6(0);
                let gradSqrNorm = 0;
                let dWpi = V(0,0);

                for (let j = 0; j < neighbors.length; j++) {
                    const jj = neighbors[j];
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

                const Ci = particle.density / particle.restDensity - 1;
                lambdas[i] = -Ci / (gradSqrNorm + this.props.relaxation);
            }


            const deltaPositions = new Array<Vector>(this.particles.length).fill(V(0,0));
            for (let i = 0; i < this.particles.length; i++) {
                const particle = this.particles[i];
                const neighbors = particle.neighbors;

                let pos = V(0,0);
                for (let j = 0; j < neighbors.length; j++) {
                    const jj = neighbors[j];
                    if (i == jj)
                        continue;

                    // const neighbor = this.particles[jj];

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
    public collisionForce(particle: Particle): void {
        for (let i = 0; i < this.walls.length; i++) {
            const wall = this.walls[i];

            const d = (wall.pos.sub(particle.pos)).dot(wall.normal);// + 0.01;

            if (d > 0.0) {
                particle.acc = particle.acc.add(wall.normal.scale(WALL_K * d));
                particle.acc = particle.acc.add(wall.normal.scale(WALL_DAMPING * particle.vel.dot(wall.normal)));
            }
        }
    }
    public collectNeighbors(newPositions: Vector[] = undefined): void {
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
