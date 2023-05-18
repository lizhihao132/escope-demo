var path = require('path');
var webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    entry: './src/scripts/app.js',
    mode: "production", // 似乎不加这一行, 页面上的 ast 节点名字被 mangle 了... 且 npm run build 也会有 warnning.
    output: {
        path: path.join(__dirname, 'dist'),
        filename: 'scripts/bundle.js'
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            // { test: /\.json$/, loader: "json-loader" },	//Since webpack >= v2.0.0, importing of JSON files will work by default
            {
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 100000
                }
            },
            {
                test: path.join(__dirname, 'src/scripts'),
                loader: 'babel-loader'
            },

            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
				/*
				use: ['style-loader', {
					loader: "css-loader",
					options: {
					  import: true,
					  url: {
						  // 将所有的 URL 路径都视为绝对路径，不进行解析
						  filter: (url) => !url.startsWith('/'),
						},

					},
				}]
				*/
				
            },
			 {
			   test: /.(woff|woff2|eot|ttf|otf)$/,
			   use: [
				 'file-loader',
			   ]
			 }
        ]
    },
    plugins: [
        // new webpack.optimize.UglifyJsPlugin({minimize: false})

        new CopyWebpackPlugin({
            patterns: [{
                from: "app/",
                to: "."
            }],
        }),

        new MiniCssExtractPlugin({
            filename: 'styles/[name].css',
            chunkFilename: 'styles/[id].css',
            //allChunks: true
        }),

        // fix "process is not defined" error:
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
    ],

	performance: {
		hints: false,	// 不再提示性能问题
		maxEntrypointSize: 512000,
		maxAssetSize: 512000
	},
    optimization: {
        minimize: false,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: false,
                    mangle: false,
                    output: {
                        beautify: true,
                        comments: true,
                    },
                },
            }),
        ],
    },
};