import {Vector} from "Vector";

export const WALL_K = 10000.0;
export const WALL_DAMPING = -0.9;

export class Wall {
    public pos: Vector;
    public normal: Vector;

    public constructor(normal: Vector, pos: Vector) {
        this.pos = pos;
        this.normal = normal;
    }
}
