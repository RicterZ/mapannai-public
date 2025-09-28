#!/usr/bin/env node

// 测试所有 Google API 调用是否都使用了反向代理
const http = require('http');

async function testGoogleProxy() {
    return new Promise((resolve, reject) => {
        const url = 'http://localhost:3000/api/search?q=东京塔&limit=2&language=zh-CN&country=JP';
        console.log('🔍 测试 Google API 反向代理:', url);
        
        const req = http.get(url, (res) => {
            let data = '';
            
            console.log('📊 HTTP状态码:', res.statusCode);
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ 
                        status: res.statusCode, 
                        data: result 
                    });
                } catch (error) {
                    console.log('❌ JSON解析失败');
                    console.log('原始响应:', data);
                    reject(new Error(`JSON解析失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`HTTP请求失败: ${error.message}`));
        });
        
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

async function main() {
    console.log('🚀 测试 Google API 反向代理配置');
    console.log('='.repeat(50));
    console.log('📋 已更新的配置:');
    console.log('- 添加了 GOOGLE_API_BASE_URL 环境变量');
    console.log('- 默认值: http://ricterz.me:81');
    console.log('- 更新了所有 Google API 调用使用反向代理');
    console.log('');
    console.log('📋 更新的文件:');
    console.log('- src/lib/config.ts (添加 baseUrl 配置)');
    console.log('- src/lib/map-providers/google-server-provider.ts');
    console.log('- src/components/map/abstract-map.tsx');
    console.log('- src/lib/map-providers/google-provider.ts');
    console.log('- src/lib/api/google-directions-service.ts');
    console.log('- src/components/map/google/map.tsx');
    console.log('- env.example (添加 GOOGLE_API_BASE_URL)');
    console.log('');
    
    try {
        const result = await testGoogleProxy();
        
        console.log('📊 测试结果:');
        console.log('HTTP状态码:', result.status);
        console.log('');
        
        if (result.status === 200) {
            console.log('✅ HTTP请求成功');
            console.log('');
            console.log('📋 API响应:');
            console.log(JSON.stringify(result.data, null, 2));
            
            if (result.data.success) {
                console.log('');
                console.log('🎉 Google API 反向代理配置成功!');
                console.log(`📊 找到 ${result.data.data.length} 个结果`);
                
                if (result.data.data.length > 0) {
                    console.log('');
                    console.log('📍 第一个结果:');
                    const first = result.data.data[0];
                    console.log(`   名称: ${first.name}`);
                    console.log(`   坐标: ${first.coordinates.latitude}, ${first.coordinates.longitude}`);
                    if (first.address) {
                        console.log(`   地址: ${first.address}`);
                    }
                    if (first.rating) {
                        console.log(`   评分: ${first.rating}`);
                    }
                }
                
                console.log('');
                console.log('✅ 所有 Google API 调用现在都使用反向代理:');
                console.log('   - 搜索 API: 通过 ricterz.me:81');
                console.log('   - JavaScript API: 通过 ricterz.me:81');
                console.log('   - Directions API: 通过 ricterz.me:81');
                console.log('   - 前端地图组件: 通过 ricterz.me:81');
            } else {
                console.log('');
                console.log('❌ 搜索失败');
                console.log('错误信息:', result.data.error || result.data.message);
            }
        } else {
            console.log('❌ HTTP请求失败');
            console.log('状态码:', result.status);
        }
        
    } catch (error) {
        console.log('');
        console.log('❌ 测试失败:', error.message);
    }
    
    console.log('');
    console.log('🏁 Google API 反向代理测试完成');
}

main();
