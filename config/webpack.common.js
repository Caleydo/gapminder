const path = require('path');
const pkg = require('./../package.json');
const webpack = require('webpack');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');
const buildInfo = require('./../buildInfo.js');
const { entries, modules, libraryExternals } = require('./../.yo-rc.json')['generator-phovea'];
const resolve = require('path').resolve;

const year = (new Date()).getFullYear();
const banner = '/*! ' + (pkg.title || pkg.name) + ' - v' + pkg.version + ' - ' + year + '\n' +
  (pkg.homepage ? '* ' + pkg.homepage + '\n' : '') +
  '* Copyright (c) ' + year + ' ' + pkg.author.name + ';' +
  ' Licensed ' + pkg.license + '*/\n';

const registryFile = './phovea_registry.js';
const actMetaData = `file-loader?name=phoveaMetaData.json!${buildInfo.metaDataTmpFile(pkg)}`;
const actBuildInfoFile = `file-loader?name=buildInfo.json!${buildInfo.tmpFile()}`;

/**
 * inject the registry to be included
 * @param entry
 * @returns {*}
 */
function injectRegistry(entry) {
  const extraFiles = [registryFile, actMetaData, actBuildInfoFile];
  // build also the registry
  if (typeof entry === 'string') {
    return extraFiles.concat(entry);
  }
  const transformed = {};
  Object.keys(entry).forEach((key) => {
    transformed[key] = extraFiles.concat(entry[key]);
    // font-awesome does not have a JavaScript component and cannot be included at this point
    transformed['vendor'] = libraryExternals.filter(name => (name != 'font-awesome'));
    transformed['phovea'] = modules;
  });
  console.log(transformed);
  return transformed;
}

const config = {
  entry: injectRegistry(entries),
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  devServer: {
    contentBase: resolve(__dirname, './../bundles/'),
    open: true,
    proxy: {
      '/api/*': {
        target: 'http://localhost:9000',
        secure: false,
        ws: true
      },
      '/login': {
        target: 'http://localhost:9000',
        secure: false
      },
      '/logout': {
        target: 'http://localhost:9000',
        secure: false
      },
      '/loggedinas': {
        target: 'http://localhost:9000',
        secure: false
      },
      watchOptions: {
        aggregateTimeout: 500,
        ignored: /node_modules/
      }
    },
    watchOptions: {
      aggregateTimeout: 500,
      ignored: /node_modules/
    }
  },
  module: {
    rules: [
      {
        test: /\.(ts)x?$/,
        use: [
          {
            loader: 'thread-loader',
            options: {
              // there should be 1 cpu for the fork-ts-checker-webpack-plugin
              workers: require('os').cpus().length - 1,
            },
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              happyPackMode: true
            },
          }
        ],
        exclude: /node_modules/
      },
      { test: /\.(xml)$/, use: 'xml-loader' },
      {
        test: /\.(png|jpg|gif|webp)$/,
        use: [ 'file-loader', `url-loader` ]
      },
      {
        test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader',
        options: {
          limit: 10000, // inline <= 10kb
          mimetype: 'application/font-woff'
        }
      },
      {
        test: /\.svg(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        loader: 'url-loader',
        options: {
          limit: 10000, // inline <= 10kb
          mimetype: 'image/svg+xml',
          esModule: false
        }
      },
      { test: /\.(ttf|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/, loader: 'file-loader' },
      // { test: /bootstrap-sass\/assets\/javascripts\//, loader: 'imports?jQuery=jquery' },
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      checkSyntacticErrors: true
    }),
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        '**/*',
        path.join(process.cwd(), './../bundles/**/*')
      ]
    }),
    new BundleAnalyzerPlugin({
    // set to 'server' to start analyzer during build
      analyzerMode: 'disabled',
      generateStatsFile: true,
      statsOptions: { source: false }
    }),
    new ManifestPlugin(),
    new webpack.BannerPlugin({
      banner: banner,
      raw: true
    })
  ],
};

module.exports = config;
