const merge = require('webpack-merge');
const path = require('path');
const webpack = require('webpack');
const common = require('./webpack.common');
const pkg = require('./../package.json');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const libName = pkg.name;
const libDesc = pkg.description;

const now = new Date();
const prefix = (n) => n < 10 ? ('0' + n) : n.toString();
const buildId = `${now.getUTCFullYear()}${prefix(now.getUTCMonth() + 1)}${prefix(now.getUTCDate())}-${prefix(now.getUTCHours())}${prefix(now.getUTCMinutes())}${prefix(now.getUTCSeconds())}`;
pkg.version = pkg.version.replace('SNAPSHOT', buildId);

const config = {
  mode: 'development',
  devtool: 'inline-source-map',
  output: {
    path: path.join(__dirname, './../bundles'),
    filename: '[name].js',
    publicPath: '',
    library: libName,
    libraryTarget: 'umd',
    umdNamedDefine: false
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              modules: true,
            },
          },
        ],
      },
      {
        test: /\.(scss)$/,
        use: [
          'style-loader', 'css-loader', 'sass-loader'
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      title: libName,
      template: 'index.template.ejs',
      inject: true,
      meta: {
        description: libDesc
      }
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      __VERSION__: JSON.stringify(pkg.version),
      __LICENSE__: JSON.stringify(pkg.license),
      __BUILD_ID__: JSON.stringify(buildId),
      __APP_CONTEXT__: JSON.stringify('/')
    })
  ]
};

module.exports = merge(common, config);
