const merge = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const MomentLocalesPlugin = require('moment-locales-webpack-plugin');
const common = require('./webpack.common');
const pkg = require('./../package.json');
const webpack = require('webpack');


const libName = pkg.name;
const libDesc = pkg.description;

const now = new Date();
const prefix = (n) => n < 10 ? ('0' + n) : n.toString();
const buildId = `${now.getUTCFullYear()}${prefix(now.getUTCMonth() + 1)}${prefix(now.getUTCDate())}-${prefix(now.getUTCHours())}${prefix(now.getUTCMinutes())}${prefix(now.getUTCSeconds())}`;
pkg.version = pkg.version.replace('SNAPSHOT', buildId);

const config = {
  mode: 'production',
  devtool: 'source-map',
  output: {
    filename: '[name].js',
    chunkFilename: '[name].js',
    path: path.resolve(__dirname, './../bundles'),
    pathinfo: false,
    publicPath: '',
    library: libName,
    libraryTarget: 'umd',
    umdNamedDefine: false
  },
  optimization: {
    splitChunks: {
      automaticNameDelimiter: '~',
      maxInitialRequests: Infinity,
      minSize: 0,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]((?!(phovea_.*|tdp_.*)).*)[\\/]/,
          chunks: 'all',
          name(module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendor.${packageName.replace('@', '')}`;
          },
        },
        phovea: {
          test: /[\\/]node_modules[\\/]((phovea_.*).*)[\\/]/,
          chunks: 'all',
          name(module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `phovea.${packageName.replace('@', '')}`;
          },
        },
        tdp: {
          test: /[\\/]node_modules[\\/]((tdp_.*).*)[\\/]/,
          chunks: 'all',
          name(module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `tdp.${packageName.replace('@', '')}`;
          },
        },
      }
    },
    // minimizer: [
    //   (compiler) => {
    //     const TerserPlugin = require('terser-webpack-plugin');
    //     new TerserPlugin({
    //         cache: true,
    //         parallel: true,
    //         sourceMap: true
    //     }).apply(compiler);
    //   }
    // ],
  },
  module: {
    rules: [
      {
        test: require.resolve('jquery'),
        use: [{
            loader: 'expose-loader',
            options: 'jQuery'
        },{
            loader: 'expose-loader',
            options: '$'
        }]
      },
      {
        test: /\.(css)$/,
        use: [
          MiniCssExtractPlugin.loader, 'css-loader'
        ]
      },
      {
        test: /\.(scss)$/,
        use: [
          MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'
        ]
      }
    ]
  },
  // TerserPlugin is added by default in production mode
  plugins: [
    new MomentLocalesPlugin({
      localesToKeep: ['de-at', 'de', 'en-gb','en'],
    }),
    // extracts css in separate file
    new MiniCssExtractPlugin({
      filename: 'styles.[name].css'
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      title: libName,
      template: 'index.template.ejs',
      inject: true,
      chunksSortMode: 'manual',
      chunks: ['vendor', 'phovea', 'app'],
      minify: {
        removeComments: true,
        collapseWhitespace: true
      },
      meta: {
        description: libDesc
      }
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VERSION__: JSON.stringify(pkg.version),
      __LICENSE__: JSON.stringify(pkg.license),
      __BUILD_ID__: JSON.stringify(buildId),
      __APP_CONTEXT__: JSON.stringify('/')
    })
  ]
};

module.exports = merge(common, config);
