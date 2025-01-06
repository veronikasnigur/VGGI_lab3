import LoadTexture from "./TextureHandler.mjs"

function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

function calculateNormalsAndTangents(vertices, indices, uvs) {
    const normals = new Float32Array(vertices.length).fill(0);
    const tangents = new Float32Array(vertices.length).fill(0);

    for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i] * 3;
        const i2 = indices[i + 1] * 3;
        const i3 = indices[i + 2] * 3;

        const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
        const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
        const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]];

        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        const uv1 = [uvs[indices[i] * 2], uvs[indices[i] * 2 + 1]];
        const uv2 = [uvs[indices[i + 1] * 2], uvs[indices[i + 1] * 2 + 1]];
        const uv3 = [uvs[indices[i + 2] * 2], uvs[indices[i + 2] * 2 + 1]];

        const deltaUV1 = [uv2[0] - uv1[0], uv2[1] - uv1[1]];
        const deltaUV2 = [uv3[0] - uv1[0], uv3[1] - uv1[1]];

        const f = 1.0 / (deltaUV1[0] * deltaUV2[1] - deltaUV1[1] * deltaUV2[0]);

        const tangent = [
            f * (deltaUV2[1] * edge1[0] - deltaUV1[1] * edge2[0]),
            f * (deltaUV2[1] * edge1[1] - deltaUV1[1] * edge2[1]),
            f * (deltaUV2[1] * edge1[2] - deltaUV1[1] * edge2[2])
        ];

        const normal = m4.normalize(m4.cross(edge1, edge2, [0, 1, 0]), []);

        normals[i1] += normal[0];
        normals[i1 + 1] += normal[1];
        normals[i1 + 2] += normal[2];

        normals[i2] += normal[0];
        normals[i2 + 1] += normal[1];
        normals[i2 + 2] += normal[2];

        normals[i3] += normal[0];
        normals[i3 + 1] += normal[1];
        normals[i3 + 2] += normal[2];

        tangents[i1] += tangent[0];
        tangents[i1 + 1] += tangent[1];
        tangents[i1 + 2] += tangent[2];

        tangents[i2] += tangent[0];
        tangents[i2 + 1] += tangent[1];
        tangents[i2 + 2] += tangent[2];

        tangents[i3] += tangent[0];
        tangents[i3 + 1] += tangent[1];
        tangents[i3 + 2] += tangent[2];
    }

    for (let i = 0; i < normals.length; i += 3) {
        const nx = normals[i];
        const ny = normals[i + 1];
        const nz = normals[i + 2];

        const tx = tangents[i];
        const ty = tangents[i + 1];
        const tz = tangents[i + 2];

        const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);
        const tangentLength = Math.sqrt(tx * tx + ty * ty + tz * tz);

        if (normalLength > 0) {
            normals[i] = nx / normalLength;
            normals[i + 1] = ny / normalLength;
            normals[i + 2] = nz / normalLength;
        }

        if (tangentLength > 0) {
            tangents[i] = tx / tangentLength;
            tangents[i + 1] = ty / tangentLength;
            tangents[i + 2] = tz / tangentLength;
        }
    }

    return { normals, tangents };
}


function makeFlatSurface(surface) {

    function makeAverageSlice(buffer, i, components) {
        let i1 = surface.indices[i];
        let i2 = surface.indices[i + 1];
        let i3 = surface.indices[i + 2];

        let v1 = buffer.slice(components * i1, components * i1 + components);
        let v2 = buffer.slice(components * i2, components * i2 + components);
        let v3 = buffer.slice(components * i3, components * i3 + components);

        let result = [];

        for(let j = 0; j < components; ++j) {
            result[j] = (v1[j] + v2[j] + v3[j]) / 3.0;
        }

        return result;
    }

    let vertices = [];
    let normals = [];
    let tangents = [];
    let uvs = [];

    for(let i = 0; i < surface.indices.length; i += 3) {
        let i1 = surface.indices[i];
        let i2 = surface.indices[i + 1];
        let i3 = surface.indices[i + 2];

        let v1 = surface.vertices.slice(3 * i1, 3 * i1 + 3);
        let v2 = surface.vertices.slice(3 * i2, 3 * i2 + 3);
        let v3 = surface.vertices.slice(3 * i3, 3 * i3 + 3);

        let normal = m4.normalize(makeAverageSlice(surface.normals, i, 3), [0, 0, 1]);
        let tangent = m4.normalize(makeAverageSlice(surface.tangents, i, 3), [0, 1, 0]);
        let uv = makeAverageSlice(surface.uvs, i, 2);

        vertices.push(...v1, ...v2, ...v3);
        normals.push(...normal, ...normal, ...normal);
        tangents.push(...tangent, ...tangent, ...tangent);
        uvs.push(...uv, ...uv, ...uv);
    }

    return {
        base: surface,
        vertices,
        normals,
        tangents,
        uvs
    };
}

export default function Model(gl, shProgram, a, p, uSegments, vSegments) {
    this.a = a;
    this.p = p;
    this.uSegments = uSegments;
    this.vSegments = vSegments;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.iTangentBuffer = gl.createBuffer();
    this.iUVBuffer = gl.createBuffer();

    this.count = 0;

    this.idTextureDiffuse = LoadTexture(gl, "./textures/diffuse.jpg");
    this.idTextureNormal = LoadTexture(gl, "./textures/normal.jpg");
    this.idTextureSpecular = LoadTexture(gl, "./textures/specular.jpg");

    // Параметричні рівняння поверхні
    this.surfaceFunction = function(u, v) {
        let omega = this.p * u;
        let x = (this.a + v) * Math.cos(omega) * Math.cos(u);
        let y = (this.a + v) * Math.cos(omega) * Math.sin(u);
        let z = (this.a + v) * Math.sin(omega);
        return [x, y, z];
    };

    // Генерація даних для поверхні та індексів
    this.generateSurfaceData = function() {
        let vertices = [];
        let indices = [];
        let uvs = [];
        let uSteps = this.uSegments;
        let vSteps = this.vSegments;
        let uMin = -Math.PI, uMax = Math.PI;
        let vMin = -this.a, vMax = 0;

        // Генерація вершин та нормалей
        for (let i = 0; i <= uSteps; i++) {
            let u = uMin + (uMax - uMin) * i / uSteps;

            for (let j = 0; j <= vSteps; j++) {
                let v = vMin + (vMax - vMin) * j / vSteps;
                let vertex = this.surfaceFunction(u, v);
                vertices.push(...vertex);

                uvs.push(normalizeUV(u, uMin, uMax), normalizeUV(v, vMin, vMax));
            }
        }

        // Генерація індексів для трикутників та нормалей
        for (let i = 0; i < uSteps; i++) {
            for (let j = 0; j < vSteps; j++) {
                let idx1 = i * (vSteps + 1) + j;
                let idx2 = (i + 1) * (vSteps + 1) + j;
                let idx3 = (i + 1) * (vSteps + 1) + j + 1;
                let idx4 = i * (vSteps + 1) + j + 1;

                // Додавання індексів трикутників
                indices.push(idx1, idx2, idx4);  // Перший трикутник
                indices.push(idx2, idx3, idx4);  // Другий трикутник
            }
        }

        const {normals, tangents } = calculateNormalsAndTangents(vertices, indices,  uvs);
        return makeFlatSurface({ vertices, indices, normals, tangents, uvs });
    };

    this.BufferData = function() {
        let surfaceData = this.generateSurfaceData();

        // Буфер вершин
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfaceData.vertices), gl.STATIC_DRAW);

        this.count = surfaceData.vertices.length / 3;

        // Буфер нормалей для Flat Shading
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfaceData.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfaceData.tangents), gl.STATIC_DRAW);

        // Буфер UV
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surfaceData.uvs), gl.STATIC_DRAW);
    };

    this.Draw = function() {
        // Вершини
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        // Нормалі
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTangentBuffer);
        gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribTangent);

        // UV
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iUVBuffer);
        gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribUV);

        // Текстури
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureDiffuse);
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureNormal);
        
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.idTextureSpecular);

        // Малюємо поверхню
        gl.drawArrays(gl.TRIANGLES, 0, this.count);
    };
}
