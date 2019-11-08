const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

function baseUrl(subdir) {
    return path.join(__dirname, ".", subdir);
}

const config = {
    entry: './app/index.ts',
    output: {
        filename: 'Bundle.js',
        path: path.resolve(__dirname, 'build')
    },
    plugins: [
        new CopyWebpackPlugin([
            {from: 'site/',       to: ''}
        ])
    ],
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.(ts)$/,
                exclude: /(node_modules)/,
                use: {
                    loader: 'ts-loader',
                    options: {onlyCompileBundledFiles: true}
                }
            }
        ]
    },
    resolve: {
        alias: {
            "Vector": baseUrl('app/utils/math/Vector'),
            "math": baseUrl('app/utils/math'),
            "app": baseUrl('app/')
        },
        extensions: ['.ts', '.js']
    }
};

module.exports = (env, argv) => {
    return config;
};
