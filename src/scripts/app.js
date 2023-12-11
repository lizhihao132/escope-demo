require('codemirror/lib/codemirror.css');
require('codemirror/theme/monokai.css');
require('../styles/main.css');
require('bootstrap/dist/css/bootstrap.css');

require('@fortawesome/fontawesome-free/css/all.css');
//import '@fortawesome/fontawesome-free/css/all.css';


var CodeMirror = require('codemirror');
require('codemirror/mode/javascript/javascript');
var $ = require('jquery');
var esprima = require('esprima');
let acorn = require('acorn')
// 扩展, 支持 class-fields.
// let acorn = require('acorn').Parser.extend(require('acorn-class-fields'));
let eslint_scope = require('lzh-eslint-scope');

var run = function() {
    'use strict';
	
	let current_is_fold = true
	const view_top_keep = 200, view_left_keep = 200	// 视距上可以保留一点空白
	const ast_tracked_dom = [], scope_tracked_dom = []
	
    var unfold = function(e, not_click_event_call, last_info, extra_info ) {
		if(e && !not_click_event_call){
			e.preventDefault();
		}
		let offset, selection_word;
		if(extra_info){
			({offset, selection_word} = extra_info)
		}
        var node = $(this).data('node');
        var level = $(this).data('level');
        var icon = $(this.parentNode).find('i.fa-plus');
        addChilds(this.parentNode, node, level);
        icon.removeClass('fa-plus');
        icon.addClass('fa-minus');
        $(this).unbind('click', unfold);
        $(this).bind('click', fold);
		current_is_fold = false
		
		if(not_click_event_call && $('input[name="use_code_track"]:checked').val() == 'track_ast'){
			// 打开子节点
			const ignore_node_name = new Set(['upper', 'through', 'variables', 'references', 'variableScope', 'childScopes'])
			let aList = $(this.parentNode).find('ul').children('li').children('a');

			let find_ = false
			for(let a of aList){
				if(a.getAttribute('class')==='tree-show') continue
				let b_str = $(a).find('b').html()
				if(ignore_node_name.has(b_str)){
					
					continue
				}
				let r = a.getAttribute('__range')
				if(r && typeof r==='string' && r.length>0){
					let range_str = r.split(',')
					let range_ = [parseInt(range_str[0]), parseInt(range_str[1])]
					if(range_[0]<=offset && offset<=range_[1]){
						find_ = true
						let offset_top = a.offsetTop
						let offset_left = a.offsetLeft
						unfold.apply(a, [null, true, {last_offset_top: offset_top, last_offset_left: offset_left, ele: a}, {offset, selection_word}])
						break
					}else{
						
					}
				}
			}
			
			// 滑动视距
			if(!find_ && last_info)
			{
				let container_dom_jq = $('#editor-container')[0]
				let top_ = last_info.last_offset_top - container_dom_jq.offsetTop - view_top_keep
				let left_ = last_info.last_offset_left - container_dom_jq.offsetLeft - view_left_keep
				for(let adom of ast_tracked_dom){
					$(adom).css('background-color', '')
				}
				$(last_info.ele).css('background-color', '#06f1f1');
				
				ast_tracked_dom.push(last_info.ele)
				container_dom_jq.scrollTo({top: top_, left: left_, behavior: 'smooth'})
			}
		}
		
		if($('input[name="use_code_track"]:checked').val() === 'track_scope'){
			// 暂不打开子节点
			
			// 滑动视距
			let container_dom_jq = $('#editor-container')[0]
			let top_ = this.offsetTop - container_dom_jq.offsetTop - view_top_keep
			let left_ = this.offsetLeft - container_dom_jq.offsetLeft - view_left_keep
			container_dom_jq.scrollTo({top: top_, left: left_, behavior: 'smooth'})
			for(let adom of scope_tracked_dom){
				$(adom).css('background-color', '')
			}
			scope_tracked_dom.push(this)
			$(this).css('background-color', '#06f1f1');
		}
    }; 

    var fold = function(e) {
        e.preventDefault();
        var icon = $(this.parentNode).find('i.fa-minus');
        icon.removeClass('fa-minus');
        icon.addClass('fa-plus');

        $(this.parentNode).find('ul').remove();
        $(this).unbind('click', fold);
        $(this).bind('click', unfold);
		
		current_is_fold = true
    };

    var addChilds = function(parent, node, level) {
		let exist_uls = $(parent).find('ul')
		if(exist_uls && exist_uls.length > 0){
			console.info('exist ul, now remove and create')
			exist_uls.remove()
		}
		
        var childs = document.createElement('ul'),
            child;

        for (var p in node) {
            if (node.hasOwnProperty(p) && node[p]) {
                child = traverseNode(node[p], p, level + 1);
                childs.appendChild(child);
            }
        }
        if (childs.childNodes.length !== 0) {
            parent.appendChild(childs);
        }
    };

    var hasChilds = function(node) {
        var p;
        if (typeof node === 'object') {
            for (p in node) {
                if (node.hasOwnProperty(p)) {
                    return true;
                }
            }
            return false;
        }

        return false;
    };

    var mark;
    var showInEditor = function(loc) {
        if (mark) {
            mark.clear();
        }
        editor.setCursor(loc.start.line - 1, loc.start.column);
        mark = editor.markText({
            line: loc.start.line - 1,
            ch: loc.start.column
        }, {
            line: loc.end.line - 1,
            ch: loc.end.column
        }, {
            className: 'cm-mark'
        });
        editor.focus();
    };
	
	let getRange = function(node){
		if(Array.isArray(node) && node.length>0 && typeof(node[0]) === 'object'){
			let left = node[0]
			let right = node[node.length-1]
			
			let begin_pos = -1, end_pos = -1
			if(left.range){
				begin_pos = left.range[0]
				end_pos = right.range[1]
			}else if(left.block){
				begin_pos = left.block.range[0]
				end_pos = right.block.range[1]
			}else{
				return null
			}
			return [begin_pos, end_pos]
		}else{
			if(node.range){
				return node.range
			}else if(node.block){
				return node.block.range
			}else{
				return null
			}
		}
	}

    var traverseNode = function(node, key, level) {
        if (!node) {
            return;
        }
        var name,
            result,
            value,
            innerValue,
            icon,
            locLink;

        name = node.constructor.name;

        if (!level) {
            level = 0;
            result = document.createElement('div');
        } else {
            result = document.createElement('li');
            value = name;
            if (typeof node !== 'object') {
                value = node.toString();
            }
            innerValue = '<b>' + key + '</b>: ' + value;
            if (hasChilds(node)) {
                icon = 'plus';
                innerValue = '<a href="#" class="tree-open"><i class="fas fa-' + icon + '"></i>' + innerValue + '</a> ';
                if (node.hasOwnProperty('loc')) {
                    locLink = $('<a href="#" class="tree-show"><i class="fas fa-hand-point-right"></i></a>');
                    locLink.click(function(e) {
                        e.preventDefault();
                        showInEditor(node.loc);
                    });
                }
            }
            $(result).html(innerValue);
            if (locLink) {
                $(result).append(locLink);
            }
        }

        if (hasChilds(node)) {
            if (level === 0) {
                addChilds(result, node, level);
            } else {
                $(result).find('a.tree-open').data('node', node);
                $(result).find('a.tree-open').data('level', level);
                $(result).find('a.tree-open').bind('click', unfold);
				
				let r = getRange(node)
				$(result).find('a.tree-open').data('__range', r);
				$(result).find('a.tree-open').attr('__range', r);
            }
        }
        if (level === 0) {
            return result.firstChild;
        }
        return result;
    };
	
	
	
	let updateLibInfo = function(is_success, parserLib, scopeLib){
		$('.parse_msg_alert').removeClass('alert-info')
		$('.parse_msg_alert').removeClass('alert-danger')
		$('.parse_msg_alert').removeClass('alert-success')
		if(null === is_success){
			$('.parse_msg_alert').addClass('alert-info')
		}
		else if(false === is_success){
			$('.parse_msg_alert').addClass('alert-danger')
		}else{
			$('.parse_msg_alert').addClass('alert-success')
		}
		
		$('#use_which_scope').text(parserLib);
		$('#use_which_parser').text(scopeLib);
			
		if('esprima' == parserLib){
			$('#parser-version').text(esprima.version);
		}
		else if('acorn' == parserLib){
			$('#parser-version').text(acorn.version);
		}
		
		if('eslint-scope' == scopeLib){
			$('#scope-version').text(eslint_scope.version);
		}
	}

	let getAst = function(code, use_acron_if_esprima_failed, ecmaVersion, sourceType, extra_info){
		let ast = null;
		/*
		// 不再使用 esprima
		try{
			extra_info.use_parser = 'esprima'
			ast = esprima.parse(code, {
				range: true,
				loc: true,
				sourceType: sourceType,
			});
		}catch(err){
			if(use_acron_if_esprima_failed)
			{	
				console.info('get ast by esprima failed, will try next parser', err)
			}
			extra_info.exception = err
		}
		if(ast){
			return ast
		}
		
		if(!ast && !use_acron_if_esprima_failed){
			console.info('---- failed, and not use acorn')
			return null
		}
		*/
		
		let acornOption = {ranges: true, locations: true, ecmaVersion: ecmaVersion, sourceType: sourceType, allowReserved: true, };
		
		try{
			extra_info.use_parser = 'acorn'
			ast = acorn.parse(code, acornOption);
			console.info('get ast by acron 1 success, with option:', acornOption, ', code length:', code.length)
		}
		catch(err){
			extra_info.exception = err
			try{
				extra_info.use_parser = 'acorn'
				acornOption = {ranges: true, locations: true}
				ast = acorn.parse(code, acornOption)	//对于这样的代码在高版本的 js 中是有效的: a = {name: 1}; b={hei:3}; c={...a,...b};
				console.info('get ast by acron 2 success, with option:', acornOption, ', code length:', code.length)
			}catch(err){
				console.info('get ast by acorn failed, will try next parser', err, ', with option:', acornOption, ', code length:', code.length)
				extra_info.exception = err
			}
		}
		if(ast){
			return ast
		}
		
		return ast
	}
	
	// 2023.06.15 发现 eval 函数导致作用域解析出错: 自 eval 往上到顶层作用域上定义的变量均解析不出 references.
	let getScopeList = function(ast, scopeLib, ecmaVersion, sourceType, ignoreEval){
		var scopes = null;
		if('eslint-scope' == scopeLib){
			scopes = eslint_scope.analyze(ast, {sourceType, ignoreEval, ecmaVersion: parseInt(ecmaVersion)}).scopes;
		}else{
			throw new Error('now will only support lzh-eslint-scope')
		}
		
		return scopes
	}
	
	let getScopeIndexByCodePos = function(target_code_pos, scope_list){
		for(let i=scope_list.length-1;i>=0; --i){
			let cur_ = scope_list[i]
			if(!cur_ || cur_.type === 'module' || cur_.type === 'global') continue
			
			let range = cur_.block.range
			if(range[0]<=target_code_pos && target_code_pos<=range[1]){
				return i
			}
		}
		return 0
	}
	
	let formatErrorToHtml2 = function(exception, code){
		let pos = parseInt(exception.index)
		console.info('pos:', pos, code.charAt(pos))
		
		let err_ident = ''
		let after_ = ''
		let i = pos;
		for(;i<code.length;++i){
			if(err_ident.length >= 40) break;
			let c = code.charAt(i)
			//if('0'<=c && c<='9' || 'a'<=c&& c<='z' || 'A'<=c&& c<='Z' || '_'==c)
			if(c != ' ' && c!= '}' && c!= '{' && c!= '\r' && c!= '\n' && c!= ';')
			{
				err_ident += c;
			}else{
				break;
			}
		}
		for(;i<code.length;++i){
			if(after_.length >= 40) break;
			let c = code.charAt(i)
			after_ += c
		}
		
		let sub_code = code.substring(pos-20, pos)
		return `"${exception.description}" at line-column-index: (${exception.lineNumber}, ${exception.column}, ${exception.index}) <br><br> ${sub_code}<b><font color='red' size='14px'>${err_ident}</font></b>${after_}`
	}
	
	let formatErrorToHtml = function(exception, code){
		
		let lineNumber = null 
		let column = null
		let index = null
		
		if(exception.loc && undefined != exception.loc.line && undefined != exception.loc.column){
			column = exception.loc.column
			lineNumber = exception.loc.line
			index = exception.pos
		}
		else{
			if(undefined != exception.lineNumber && undefined != exception.column && undefined != exception.index){
				column = exception.column
				index = exception.index
				lineNumber = exception.lineNumber
			}
		}
		
		//console.info('------------------- lineNumber:', lineNumber, ', column:', column, ', index:', index)
		
		let npos = parseInt(index)
		
		let ret = `"${exception.message}" at line-column-index: (${lineNumber}, ${column}, ${index}) <br><br> ${code.substring(npos-20, npos)}<b><font color='red' size='14px'>${code.charAt(npos)}</font></b>${code.substring(npos+1, npos+20)}`
		
		return ret
	}
	
	let ecmaVersion,sourceType,ast,scopes
    var body = $("body")
    var draw = function() {
        //body.removeClass("bg-warning");
		
		ecmaVersion = $('input[name="es"]:checked').val();
		sourceType = $('input[name="st"]:checked').val();
		
		//let scopeLib = $('input[name="scope_lib"]:checked').val();
		const scopeLib = 'eslint-scope'
		// let use_acron_if_esprima_failed = $('input[name="use_acron_if_esprima_failed"]:checked').val() == 'yes' 
		let ignore_eval_in_scope = true
		if(undefined != window.ignore_eval && null != window.ignore_eval){
			ignore_eval_in_scope = window.ignore_eval
		}
		
		console.info('parse params, ecmaVersion:', ecmaVersion, ', sourceType:', sourceType, ', scopeLib:', scopeLib)
		console.info('ecmaVersion list:  3, 5, 6 (or 2015), 7 (2016), 8 (2017), 9 (2018), 10 (2019), 11 (2020), 12 (2021), 13 (2022), 14 (2023), or "latest" (the latest the library supports)')
		let extra_info = {}
		let is_success = null
		//默认 parser 是 esprima, 当 parser 失败时, 使用 acorn -- 20230809, 不再使用 esprima
		updateLibInfo(is_success, 'acorn', scopeLib)
		let code = editor.getValue()
        try{
			$('#treeview').html('');
			
			if(code.length == 0) return;
			
			ast = getAst(code, false/*use_acron_if_esprima_failed*/, ecmaVersion, sourceType, extra_info)
			if(!ast){
				//body.addClass("bg-warning");
				console.info(extra_info.exception)
				$('#treeview').html(formatErrorToHtml(extra_info.exception, code));
			}else{
				scopes = getScopeList(ast, scopeLib, ecmaVersion, sourceType, ignore_eval_in_scope)
				let nodes = traverseNode(scopes, true);
				$('#treeview').append(nodes);
			}
			is_success = !!ast;
        } catch(e){
            //body.addClass("bg-warning");
            console.error(e);
			$('#treeview').html(formatErrorToHtml(e, code));
        }
		
		// 当解析完成时, 应当报告最后一次使用的 parser
		if(!is_success){
			console.info('last failed parser:', extra_info.use_parser)
		}
		updateLibInfo(is_success, extra_info.use_parser, scopeLib)
    };

    var editor = CodeMirror.fromTextArea($('#editor')[0], {
        viewportMargin: Infinity,
        matchBrackets: true,
        continueComments: 'Enter',
        mode: 'javascript',
        lineNumbers: true
    });
	
	// 当停止输入代码超过这个秒数, 再执行 draw
	const draw_if_stop_edit_for_seconds = 1
	var last_edit_time = new Date().getTime()
	let cur_timer = null
    editor.on('change', function(){
		let cur_time = new Date().getTime()
		if(null != cur_timer){
			clearTimeout(cur_timer)
		}
		cur_timer = setTimeout(function(){
			draw()
			cur_timer = null
		}, draw_if_stop_edit_for_seconds*1000)
		last_edit_time = cur_time
	});
	
    $('input[name="es"]').change(function() { ecmaVersion = $(this).val(); draw();});
    $('input[name="st"]').change(function() { sourceType = $(this).val(); draw();})

	$('input[name="scope_lib"]').change(function() { draw();})
	//$('input[name="use_acron_if_esprima_failed"]').change(function() { draw();})
	
	editor.getWrapperElement().addEventListener('dblclick', function(event) {
	  {
		let no_track = $('input[name="use_code_track"]:checked').val() == 'no_track'
		if(no_track) return;

		const cursor = editor.getCursor();
		const offset = editor.indexFromPos(cursor);
		
		const selection_word = editor.getSelection();
	    console.info('sel:', selection_word)
		
		// 展开 AST 节点: 从 ast 的根节点 (Module) 开始展开(当是 module 模式解析, 则整个语法树第 2 个即是根节点, 否则第 1 个)
		if($('input[name="use_code_track"]:checked').val() == 'track_ast')
		{
			let start_at = ('module'===sourceType)? 2:1	// jquery 查找器从 1 开始
			let module_node = $("#treeview > ul > li:nth-child(" + start_at + ") a")[0]	// 最后的 [0] 是为了将 jquery 对象转换为 dom 节点.
			unfold.apply(module_node, [null, true, {}, {offset,selection_word}])
			
			// 如果当前是闭合的, 就展开
			if(current_is_fold){
				unfold.apply(module_node, [null, true, {}, {offset, selection_word}])
			}		
		}

		// 展开 scope 作用域
		if($('input[name="use_code_track"]:checked').val() == 'track_scope')
		{
			let index = getScopeIndexByCodePos(offset, scopes)
			let start_offset = ('module'===sourceType)? 2:1
			let start_at = index + 1
			let scope_node = $("#treeview > ul > li:nth-child("+ start_at +") a")[0]	// 加 [0] 是为了将 jquery 对象转换为 dom 节点.
			unfold.apply(scope_node, [null, false, {}, {offset, selection_word}])
			
			// 如果当前是闭合的, 就展开
			if(current_is_fold){
				unfold.apply(scope_node, [null, false, {}, {offset, selection_word}])
			}
		}
	  }
	});
	
	
    draw();

	
};  // end run


run();
