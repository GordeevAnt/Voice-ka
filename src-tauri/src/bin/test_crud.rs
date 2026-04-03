// src-tauri/bin/test_crud.rs
use voice_ka_lib::db::{init_db, create_msg, get_msgs, get_msg, update_msg, delete_msg};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Инициализируем БД
    init_db().await?;
    
    // Сначала создаем тестовые данные в связанных таблицах
    println!("=== ПОДГОТОВКА ТЕСТОВЫХ ДАННЫХ ===");
    
    let pool = voice_ka_lib::db::get_pool_for_test();
    
    // Создаем тестовую комнату (если её нет)
    sqlx::query(
        "INSERT INTO rooms (id, name, type) VALUES (1, 'General', 'text') ON CONFLICT (id) DO NOTHING"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "INSERT INTO rooms (id, name, type) VALUES (2, 'Music', 'voice') ON CONFLICT (id) DO NOTHING"
    )
    .execute(pool)
    .await?;
    
    // Создаем тестового пользователя (если его нет)
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash) VALUES (1, 'alice', 'alice@test.com', 'hash123') ON CONFLICT (id) DO NOTHING"
    )
    .execute(pool)
    .await?;
    
    sqlx::query(
        "INSERT INTO users (id, username, email, password_hash) VALUES (2, 'bob', 'bob@test.com', 'hash456') ON CONFLICT (id) DO NOTHING"
    )
    .execute(pool)
    .await?;
    
    println!("✅ Тестовые данные созданы\n");
    
    println!("=== ТЕСТИРОВАНИЕ CRUD ОПЕРАЦИЙ ===\n");
    
    // 1. CREATE - создаем сообщения
    println!("1. CREATE:");
    let msg1 = create_msg(1, 1, "Первое сообщение".to_string()).await?;
    println!("   ✅ Создано сообщение ID: {}", msg1.id);
    
    let msg2 = create_msg(1, 2, "Второе сообщение".to_string()).await?;
    println!("   ✅ Создано сообщение ID: {}", msg2.id);
    
    let msg3 = create_msg(2, 1, "Сообщение в другой комнате".to_string()).await?;
    println!("   ✅ Создано сообщение ID: {}", msg3.id);
    println!("   Создано 3 сообщения\n");
    
    // 2. READ - читаем все сообщения из комнаты 1
    println!("2. READ - все сообщения в комнате 1:");
    let all_msgs = get_msgs(1).await?;
    for msg in &all_msgs {
        println!("   [{}] user {}: {}", msg.id, msg.user_id, msg.content);
    }
    println!();
    
    // 3. READ - читаем одно сообщение
    println!("3. READ - одно сообщение:");
    if let Some(msg) = get_msg(msg1.id).await? {
        println!("   Сообщение {}: {}", msg.id, msg.content);
    }
    println!();
    
    // 4. UPDATE - обновляем сообщение
    println!("4. UPDATE:");
    let updated = update_msg(msg1.id, 1, "Обновленное первое сообщение".to_string()).await?;
    if updated {
        if let Some(msg) = get_msg(msg1.id).await? {
            println!("   Сообщение {} обновлено: {}", msg.id, msg.content);
        }
    }
    println!();
    
    // 5. DELETE - удаляем сообщение
    println!("5. DELETE:");
    let deleted = delete_msg(msg2.id, 2).await?;
    if deleted {
        println!("   Сообщение {} удалено", msg2.id);
    }
    
    // Проверяем финальное состояние
    println!("\n=== ФИНАЛЬНОЕ СОСТОЯНИЕ ===");
    let final_msgs = get_msgs(1).await?;
    println!("Осталось {} сообщений в комнате 1:", final_msgs.len());
    for msg in final_msgs {
        println!("  [{}] user {}: {}", msg.id, msg.user_id, msg.content);
    }
    
    // Показываем все сообщения из комнаты 2
    let room2_msgs = get_msgs(2).await?;
    println!("\nСообщения в комнате 2 ({} шт.):", room2_msgs.len());
    for msg in room2_msgs {
        println!("  [{}] user {}: {}", msg.id, msg.user_id, msg.content);
    }
    
    Ok(())
}