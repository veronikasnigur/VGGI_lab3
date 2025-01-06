import LoadTexture from "./TextureHandler.mjs"

function normalizeUV(value, min, max) {
    return (value - min) / (max - min);
}

// Функція для розрахунку нормалі для одного трикутника
this.calculateTriangleNormal = function(u1, v1, u2, v2, u3, v3) {
    // Розрахунок трьох точок
    let p1 = this.surfaceFunction(u1, v1);
    let p2 = this.surfaceFunction(u2, v2);
    let p3 = this.surfaceFunction(u3, v3);

    // Розрахунок векторів двох сторін трикутника
    let edge1 = [
        p2[0] - p1[0],
        p2[1] - p1[1],
        p2[2] - p1[2]
    ];
    let edge2 = [
        p3[0] - p1[0],
        p3[1] - p1[1],
        p3[2] - p1[2]
    ];

    // Векторний добуток для отримання нормалі трикутника
    let normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ];

    // Нормалізація нормалі
    let length = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
    if (length !== 0) {
        normal = normal.map(n => n / length);
    } else {
        normal = [0, 0, 1]; // Вектор за замовчуванням
    }

    return normal;
};

// Генерація даних для поверхні та індексів
this.generateSurfaceData = function() {
    let vertices = [];
    let indices = [];
    let flatNormals = [];
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
        }
    }

    // Генерація індексів для трикутників та нормалей
    for (let i = 0; i < uSteps; i++) {
        for (let j = 0; j < vSteps; j++) {
            let idx1 = i * (vSteps + 1) + j;
            let idx2 = (i + 1) * (vSteps + 1) + j;
            let idx3 = (i + 1) * (vSteps + 1) + j + 1;
            let idx4 = i * (vSteps + 1) + j + 1;

            // Обчислення нормалі для першого трикутника
            let normal1 = this.calculateTriangleNormal(
                i * (Math.PI / uSteps), j * (this.a / vSteps),
                (i + 1) * (Math.PI / uSteps), j * (this.a / vSteps),
                (i + 1) * (Math.PI / uSteps), (j + 1) * (this.a / vSteps)
            );
            flatNormals.push(...normal1, ...normal1, ...normal1);

            // Обчислення нормалі для другого трикутника
            let normal2 = this.calculateTriangleNormal(
                i * (Math.PI / uSteps), j * (this.a / vSteps),
                (i + 1) * (Math.PI / uSteps), (j + 1) * (this.a / vSteps),
                i * (Math.PI / uSteps), (j + 1) * (this.a / vSteps)
            );
            flatNormals.push(...normal2, ...normal2, ...normal2);

            // Додавання індексів трикутників
            indices.push(idx1, idx2, idx4);  // Перший трикутник
            indices.push(idx2, idx3, idx4);  // Другий трикутник
        }
    }

    return { vertices, indices, flatNormals };
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
