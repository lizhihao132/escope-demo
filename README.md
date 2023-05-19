## Demo
[![escope-demo](https://raw.github.com/lizhihao132/escope-demo/master/app/images/screenshot.gif)](http://lizhihao132.github.io/escope-demo/)
## 部署此站点的方法
### 更新库
若要更新 escope / eslint-scope / esprima / acron 库, 直接在项目目录下执行以下命令, 以 escope 为例, 更新到 xxx 版本
npm view escope version, 然后 npm i escope@xxx
注意不能直接改 package.json 里的版本号再 npm install, 这无法处理好依赖关系(无法递归更新依赖库版本).

### 打包
确保 package.json 中有以下配置, 再 npm run build , 配置内容: 
   "scripts": {
     "build": "webpack --config webpack.config.js"
   }

### 运行
dist 目录下即为打包好的站点目录, 在里面 npx serve, 浏览器就可以访问  localhost:3000 即可.
