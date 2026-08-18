# Unwrap

**[English](README.md) · [简体中文](README.zh.md)**

把藏在 Word 文档里的音频取出来。

**→ [mariatta.ca/unwrap](https://mariatta.ca/unwrap/)**

## 文件不会被上传

你的文档不会离开你的电脑。没有服务器，没有上传，不需要账号，也没有任何统计追踪：
网页用浏览器自带的接口读取文件，再把音频直接写进你的下载文件夹。你可以打开页面之后
断网，它照样能用。

## 为什么会有这个工具

一位英语老师把课堂听力音频做成 MP3，嵌进 Word 文档里发给全班。在他自己的电脑上，
这么做完全合理：点一下喇叭图标，录音就播放了。

换一台设备就不行了。他的学生并不都用 Windows，在 Mac、手机或者 Chromebook 上，
音频明明就在文件里，却怎么也拿不出来。出问题的是格式，不是人。这个工具补上的，
就是那封邮件缺掉的另一半。

最初的帖子：<https://fosstodon.org/@mariatta/117114000531151134>

## 支持哪些文件

Word、PowerPoint 和 Excel 保存的文档：`.docx`、`.docm`、`.doc`、`.dotx`、
`.pptx`、`.ppt`、`.xlsx`、`.xls`。可以一次拖进多个文件，它会逐个处理；
结果有两个以上时，可以打包成一个 ZIP 下载。

界面提供英文和简体中文。你选择的语言会被记住，第一次访问时则跟随浏览器的语言设置。

## 有一种情况谁也救不了

如果发件人用的是 *插入 → 对象 → **链接到文件***，音频压根就没有放进文档里，
文件中只存了一个指向他自己电脑上某个 MP3 的路径。这种情况谁也恢复不了，
换任何工具都一样：请他把 MP3 作为普通附件重新发一次。

## 原理

`.docx` 本身就是一个 ZIP。嵌入的对象放在 `word/embeddings/oleObject1.bin`，
而它又是一个完整的
[OLE 复合文件](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/)
：相当于一个小型文件系统，有自己的扇区分配表、目录树，小文件还另有一条独立的流。
Unwrap 按照规范逐段跟着扇区链走，而不是假设 MP3 一定连续存放，因为这个假设一旦不成立，
取出来的音频会悄无声息地损坏。

在复合文件内部，音频数据外面还包着一层 OLE 1.0 Packager 头，里面记着发件人原本的
文件名和准确的字节长度。所以你下载到的文件名字是正常的，内容和他当初插入的那份
一字节不差。万一这个头读不出来，Unwrap 会退回到按音频特征码扫描，并在结果里注明
文件末尾可能多出几个字节。

## 本地开发

```bash
npm install
npm run fixtures     # 首次运行测试前必须执行：tests/fixtures/ 不纳入版本管理
npm test
npm run serve        # http://localhost:8000
```

`npm run fixtures` 需要 Python 3（只用标准库）。测试需要 Node 20.11 或更高版本。

整个应用就是一个 `index.html`：结构、样式、两种语言和全部逻辑都在里面，没有构建步骤。

## 致谢

ZIP 的读写由 [JSZip](https://stuk.github.io/jszip/) 完成（MIT 许可）。

## 许可

[MIT](LICENSE)
