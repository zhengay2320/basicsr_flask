# from sqlalchemy import text
#
# from app import create_app
# from app.extensions import db
#
#
# def drop_task_config_training_columns():
#     """
#     一次性脚本：删除 task_config 表中多余的训练配置字段。
#     使用方式：
#       在项目根目录执行：python manage.py
#     """
#     ddl = """
#     ALTER TABLE task_config
#       DROP COLUMN optim_g_lr,
#       DROP COLUMN optim_d_lr,
#       DROP COLUMN ema_decay,
#       DROP COLUMN save_checkpoint_freq,
#       DROP COLUMN print_freq,
#       DROP COLUMN total_iter,
#       DROP COLUMN warmup_iter;
#     """
#
#     app = create_app()
#     with app.app_context():
#         db.session.execute(text(ddl))
#         db.session.commit()
#         print("Dropped training config columns from task_config.")
#
# #
# if __name__ == "__main__":
#     drop_task_config_training_columns()

# import os
# from PIL import Image
#
# # 修改这里
# img_dir = r'G:\NewLuojia_Dataset\RescData\mini'
# save_path = r'E:\myMLPro\datasets\meta_info.txt'
#
# with open(save_path, 'w') as f:
#     for name in sorted(os.listdir(img_dir)):
#         if name.endswith(('.png', '.jpg', '.jpeg')):
#             img = Image.open(os.path.join(img_dir, name))
#             width, height = img.size
#             # 写入格式: 文件名 (高,宽,通道数)
#             f.write(f'{name} ({height},{width},3)\n')
# print(f"Done! Saved to {save_path}")
#
import os
from PIL import Image

# 输入和输出路径
input_dir = '/home/ubuntu/data/zhenganyang/myMLPro/datasets/mini'  # 高分辨率图像文件夹
output_dir = '/home/ubuntu/data/zhenganyang/myMLPro/datasets/minilr'  # 低分辨率图像保存路径
scale_factor = 4  # 降采样倍数

# 创建输出文件夹（如果不存在的话）
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 遍历输入文件夹中的所有图片
for img_name in os.listdir(input_dir):
    if img_name.endswith(('.jpg', '.png', '.jpeg')):  # 只处理图像文件
        img_path = os.path.join(input_dir, img_name)

        # 打开图像并获取原始图像的大小
        img = Image.open(img_path)
        original_width, original_height = img.size

        # 计算降采样后的新尺寸
        new_width = original_width // scale_factor
        new_height = original_height // scale_factor

        # 执行降采样
        img_resized = img.resize((new_width, new_height), Image.BICUBIC)

        # 保存降采样后的图像，保持原文件名
        low_res_img_path = os.path.join(output_dir, img_name)
        img_resized.save(low_res_img_path)

        print(f"Saved: {low_res_img_path}")

print("所有低分辨率图像已生成完成！")


