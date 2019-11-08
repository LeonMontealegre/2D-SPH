import {Vector, V} from "Vector";

export const DEFAULT_MASS = 0.02;
export const GAS_STIFFNESS = 3;//k = 3;//8.314;
export const REST_DENSITY = 998.29;//ρ0 = 998.29;//100;
export const VISCOSITY = 10.5;

export class Particle {
    public pos: Vector;
    public vel: Vector;
    public acc: Vector;

    public mass: number;
    public restDensity: number;
    public viscosity: number;
    public gasConstant: number;

    public density: number;
    public pressure: number;
    public neighbors: number[];

    public constructor(pos: Vector,
                       mass: number = DEFAULT_MASS,
                       restDensity: number = REST_DENSITY,
                       viscosity: number   = VISCOSITY,
                       gasConstant: number = GAS_STIFFNESS) {
        this.pos = pos;
        this.vel = V();
        this.acc = V();

        this.mass        = mass;
        this.restDensity = restDensity;
        this.viscosity   = viscosity;
        this.gasConstant = gasConstant;

        this.density   = 0;
        this.pressure  = 0;
        this.neighbors = [];
    }
    public accelerate(a: Vector): void {
        // Newton's law a = F/m
        this.acc = a;
    }
}
