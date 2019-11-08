// import "jest";
// import {SPH, SPHPropsBuilder} from "app/SPH";

// import expectedJson from "./expected.general.json";

// describe("General Test", () => {
//     const sph = new SPH(new SPHPropsBuilder().build());
//     sph.init();

//     // Step 100 times
//     for (let i = 0; i < 100; i++)
//         sph.step();

//     const final = JSON.stringify(sph.particles);
//     expect(final).toBe(expectedJson);
// });

import "jest";

import json from "./expected.general.json";

import {SPH, SPHPropsBuilder} from "app/SPH";
import {Vector, V} from "Vector";

// const expected = json["particles"].sort((a, b) => a.id - b.id);

// function expectVectorMatch(v1: Vector, v2: Vector, numDigits = 2): void {
//     expect(v1.x).toBeCloseTo(v2.x, numDigits);
//     expect(v1.y).toBeCloseTo(v2.y, numDigits);
// }

describe("asd", () => {
    test("asd", () => {
        const sph = new SPH(new SPHPropsBuilder().build());
        sph.init("test1");

        // Step 100 times
        for (let i = 0; i < 100; i++)
            sph.step();

        expect(sph.particles).toEqual(json["particles"]);

        // const actual = sph.particles.slice().sort((a, b) => a.id - b.id);

        // expect(actual).toHaveLength(expected.length);
        // for (let i = 0; i < actual.length; i++) {
        //     const a = actual[i];
        //     const b = expected[i];

        //     expect(a.id).toBe(b.id);
        //     expectVectorMatch(a.pos, V(b.pos.x, b.pos.y));
        //     expectVectorMatch(a.vel, V(b.vel.x, b.vel.y));
        //     expectVectorMatch(a.acc, V(b.acc.x, b.acc.y));
        //     expect(a.mass).toBeCloseTo(b.mass, 1);
        //     expect(a.restDensity).toBeCloseTo(b.restDensity, 1);
        //     expect(a.viscosity).toBeCloseTo(b.viscosity, 1);
        //     expect(a.gasConstant).toBeCloseTo(b.gasConstant, 1);
        //     expect(a.density).toBeCloseTo(b.density, 1);
        //     expect(a.pressure).toBeCloseTo(b.pressure, 1);

        //     expect(a.neighbors).toHaveLength(b.neighbors.length);
        //     expect(a.neighbors).toEqual(b.neighbors);
        // }
    });
});