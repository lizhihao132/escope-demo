function transform(code){
		if(code.length === 0){
			return '""';
		}

		let cb = new ConfusionBase(code);
		let ast = cb.getAst();
		if(!ast){
			console.info('mangle shorten_var ast error.');
			fs.writeFileSync('err.js', code, {flag: 'w'});
			process.exit(1);
			return code;
		}
		
		let sourceType = cb.getSourceType();
		
		let iw = new MarkCannotRenameIdentifyWalker();
		let combineWalker = new AstCombineNodeWalker(ast, [iw], true);	// 第三个参数 true 表示不加入 parent, false 表示加入 parent
		combineWalker.doWalk();
		
		let scopeAnalysis = new ScopeAnalysis(code, ast, sourceType)
		let mayGlobalVars = scopeAnalysis.getMayGlobalVars()
		
		let nameService = new NameTransformService(mayGlobalVars)
		
		let entry_list = []
		
		for(let [decl_nodes, ref_nodes] of scopeAnalysis.getDeclsToRefListMap()){
			let cannot_rename = false;
			let cur_name_set = new Set
			for(let d of decl_nodes){
				cur_name_set.add(d.name)
				if(d.__cannot_rename === true){
					cannot_rename = true;
					break;
				}
			}
			for(let r of ref_nodes){
				cur_name_set.add(r.name)
				if(r.__cannot_rename === true){
					cannot_rename = true;
					break;
				}
			}
			if(!cannot_rename){
				entry_list.push({
					decl_nodes,
					ref_nodes
				})
			}else{
				console.info('---- cannot rename:', cur_name_set)
			}
		}
		
		// 按总个数逆序排列.
		entry_list.sort(function(left, right){
			let left_len = left.decl_nodes.length + left.ref_nodes.length
			let right_len = right.decl_nodes.length + right.ref_nodes.length
			if(left_len < right_len)return 1;
			else if(left_len > right_len)return -1;
			return 0
		})
		
		let code_editor_list = []
		
		let dealed = new Set
		for(let entry of entry_list){
			let cur_name = nameService.generateNextOrderedName()
			
			for(let decl of entry.decl_nodes){
				if(dealed.has(decl)) continue;
				dealed.add(decl)
				let update_decl_code = {
					range: decl.range,
					target_code: `${cur_name}${DEBUG_SHORTEN?'/*' + decl.name + '*/':''}`,
					type: "replace",
					name: "for_decl",
					z_index: 0
				}
				code_editor_list.push(update_decl_code)
			}
			
			for(let ref of entry.ref_nodes){
				if(dealed.has(ref)) continue;
				dealed.add(ref)
				let update_decl_code = {
					range: ref.range,
					target_code: `${cur_name}${DEBUG_SHORTEN?'/*' + ref.name + '*/':''}`,
					type: "replace",
					name: "for_decl",
					z_index: 0
				}
				code_editor_list.push(update_decl_code)
			}
		}
		
		let new_code = codeEditorEngine.edit(code, code_editor_list)
		return new_code
	}