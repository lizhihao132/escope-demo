require('codemirror/lib/codemirror.css');
require('codemirror/theme/monokai.css');
require('../styles/main.css');
require('bootstrap/dist/css/bootstrap.css');

require('@fortawesome/fontawesome-free/css/all.css');
//import '@fortawesome/fontawesome-free/css/all.css';


var CodeMirror = require('codemirror');
require('codemirror/mode/javascript/javascript');
var $ = require('jquery');
var escope = require('escope');
var esprima = require('esprima');
let acorn = require('acorn')
let eslint_scope = require('eslint-scope');

var run = function() {
    'use strict';
    var unfold = function(e) {
        e.preventDefault();
        var node = $(this).data('node');
        var level = $(this).data('level');
        var icon = $(this.parentNode).find('i.fa-plus');
        addChilds(this.parentNode, node, level);
        icon.removeClass('fa-plus');
        icon.addClass('fa-minus');
        $(this).unbind('click', unfold);
        $(this).bind('click', fold);
    }; 

    var fold = function(e) {
        e.preventDefault();
        var icon = $(this.parentNode).find('i.fa-minus');
        icon.removeClass('fa-minus');
        icon.addClass('fa-plus');

        $(this.parentNode).find('ul').remove();
        $(this).unbind('click', fold);
        $(this).bind('click', unfold);
    };

    var addChilds = function(parent, node, level) {
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
            }
        }
        if (level === 0) {
            return result.firstChild;
        }
        return result;
    };
	
	let updateLibInfo = function(parserLib, scopeLib){
		$('#use_which_scope').text(parserLib);
		$('#use_which_parser').text(scopeLib);
			
		if('esprima' == parserLib){
			$('#parser-version').text(esprima.version);
		}
		else if('acorn' == parserLib){
			$('#parser-version').text(acorn.version);
		}
		
		if('escope' == scopeLib){
			$('#scope-version').text(escope.version);
		}else if('eslint-scope' == scopeLib){
			$('#scope-version').text(eslint_scope.version);
		}
	}

	let getAst = function(code, use_acron_if_esprima_failed, ecmaVersion, sourceType, extra_info){
		var ast = null;
		let parserLib, scopeLib;
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
				console.info('parse ast by esprima failed, will try next parser', err)
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
		
		let acornOption = {ranges: true, locations: true, ecmaVersion: ecmaVersion, sourceType: sourceType, allowReserved: true, };
		
		try{
			extra_info.use_parser = 'acorn'
			ast = acorn.parse(code, acornOption);
			console.info('parse ast by acron 1 success')
		}
		catch(err){
			extra_info.exception = err
			try{
				extra_info.use_parser = 'acorn'
				ast = acorn.parse(code, {ranges: true, locations: true})	//对于这样的代码在高版本的 js 中是有效的: a = {name: 1}; b={hei:3}; c={...a,...b};
				console.info('parse ast by acron 2 success')
			}catch(err){
				console.info('parse ast by acorn failed, will try next parser', err)
				extra_info.exception = err
			}
		}
		if(ast){
			return ast
		}
		
		return ast
	}
	
	let getScopeList = function(ast, scopeLib, ecmaVersion, sourceType){
		var scopes = null;
		if('escope' == scopeLib){
			scopes = escope.analyze(ast, {sourceType: sourceType, ecmaVersion: parseInt(ecmaVersion)}).scopes;
		}else if('eslint-scope' == scopeLib){
			scopes = eslint_scope.analyze(ast, {sourceType: sourceType, ecmaVersion: parseInt(ecmaVersion)}).scopes;
		}
		
		return scopes
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
	
	let ecmaVersion,sourceType
    var body = $("body")
    var draw = function() {
        body.removeClass("bg-warning");
		
		let ecmaVersion = $('input[name="es"]:checked').val();
		let sourceType = $('input[name="st"]:checked').val();
		let scopeLib = $('input[name="scope_lib"]:checked').val();
		let use_acron_if_esprima_failed = $('input[name="use_acron_if_esprima_failed"]:checked').val() == 'yes' 
		
		console.info('parse params, ecmaVersion:', ecmaVersion, ', sourceType:', sourceType, ', scopeLib:', scopeLib, ', use_acron_if_esprima_failed:', use_acron_if_esprima_failed)
		let extra_info = {}
		
		//默认 parser 是 esprima, 当 parser 失败时, 使用 acorn
		updateLibInfo('esprima', scopeLib)
        try{
			$('#treeview').html('');
			
			let code = editor.getValue()
			if(code.length == 0) return;
			
			let ast = getAst(code, use_acron_if_esprima_failed, ecmaVersion, sourceType, extra_info)
			if(!ast){
				body.addClass("bg-warning");
				console.info(extra_info.exception)
				$('#treeview').html(formatErrorToHtml(extra_info.exception, code));
			}else{
				let scopes = getScopeList(ast, scopeLib, ecmaVersion, sourceType, extra_info)
				let nodes = traverseNode(scopes, true);
				$('#treeview').append(nodes);
			}
        } catch(e){
            body.addClass("bg-warning");
            console.error(e);
			$('#treeview').html(formatErrorToHtml(e, code));
        }
		
		// 当解析完成时, 应当报告最后一次使用的 parser
		console.info('last failed parser:', extra_info.use_parser)
		updateLibInfo(extra_info.use_parser, scopeLib)
    };

    var editor = CodeMirror.fromTextArea($('#editor')[0], {
        viewportMargin: Infinity,
        matchBrackets: true,
        continueComments: 'Enter',
        mode: 'javascript',
        lineNumbers: true
    });


    editor.on('change', draw);
    $('input[name="es"]').change(function() { ecmaVersion = $(this).val(); draw();});
    $('input[name="st"]').change(function() { sourceType = $(this).val(); draw();})

    draw();

	
};  // end run


run();
