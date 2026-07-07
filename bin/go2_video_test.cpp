#include <unitree/robot/go2/video/video_client.hpp>

#include <cstdio>
#include <iostream>
#include <vector>
#include <unistd.h>

using namespace unitree::robot;

int main()
{
    setvbuf(stdout, nullptr, _IONBF, 0);

    ChannelFactory::Instance()->Init(0);

    go2::VideoClient video;

    video.SetTimeout(1.0f);
    video.Init();

    std::vector<uint8_t> image;

    while (true)
    {
        if (video.GetImageSample(image) == 0 && !image.empty())
        {
            uint32_t size = static_cast<uint32_t>(image.size());

            std::cout.write(
                reinterpret_cast<char*>(&size),
                sizeof(size)
            );

            std::cout.write(
                reinterpret_cast<char*>(image.data()),
                image.size()
            );

            std::cout.flush();
        }

        usleep(200000); // ~5 FPS — preview de prueba
    }

    return 0;
}