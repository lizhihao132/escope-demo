const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: './src/scripts/app.js',
    mode: "production",
    output: {
        path: __dirname + '/dist',
        filename: 'scripts/bundle.js',
    },
    module: {
        rules: [
			/*
			下面这个配置会导致页面上的 font-awesome 显示不正常, 原因暂未知
			{
                test: /\.(png|woff|woff2|eot|ttf|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 100000
                }
            },	
			*/
			/*
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
			*/

            {
                test: /\.css$/,
                // use: ['style-loader', 'css-loader']	//style-loader 是动态插入 <style> 对调试友好; MiniCssExtractPlugin 是生成整个 css 文件,性能更好
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            }
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './static/index.html',
            minify: false, // 禁用压缩功能
            inject: false, // 禁止字符串变换

        }),
        // fix "process is not defined" error:
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new MiniCssExtractPlugin({
            filename: 'styles/[name].css',
            chunkFilename: 'styles/[id].css',
        }),
		new CopyWebpackPlugin({
            patterns: [{
                from: "static/",
                to: "."
            }],
        }),
    ],
    devServer: {
        static: {
            directory: './dist',
        },
    },

    performance: {
        hints: false, // 不再提示性能问题
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
}